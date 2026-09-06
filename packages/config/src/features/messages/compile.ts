import {
  type Content,
  type FunctionArg,
  type Octothorpe,
  parse,
  type PlainArg,
  type Select,
} from '@messageformat/parser';
import type { Message } from 'saykit';
import { dateTimeStyle, type NumberOptions, numberStyle, StyleError } from './styles.js';

/**
 * ICU MessageFormat 1, compiled to a {@link Message}.
 *
 * Everything a message needs is known here: a style resolves to an `Intl`
 * options bag and is written into the tree as a literal, so what ships is data
 * over four runtime helpers, and nothing parses anything at runtime.
 *
 * Data rather than source is what makes a locale serialisable, which is what a
 * server handing its messages to a client tree needs. It is also what keeps ICU
 * at arm's length: another message format compiles to the same nodes, and the
 * runtime never learns which one it came from.
 *
 * The locale is not here either. A message is bound to one when the view that
 * holds it compiles it.
 */

type Token = Content | PlainArg | FunctionArg | Select | Octothorpe;

/** `=3` names the number three; anything else names a CLDR category. */
const EXACT = /^=\d+$/;

/**
 * The descriptor key an ICU argument reads from.
 *
 * The transform prefixes every value with one underscore, so `{name}` is
 * `_name` and a message argument really called `_total` is `__total`. The
 * mapping is known here, so it is written in rather than applied per call.
 */
function reference(argument: string): Message {
  return ['v', `_${argument}`];
}

/**
 * A run of nodes, as one node.
 *
 * A single node stands on its own rather than being wrapped in a concatenation
 * that would only stringify what is already a string, and an empty run is the
 * empty string.
 */
function concat(nodes: Message[]): Message {
  if (nodes.length === 0) return '';
  if (nodes.length === 1) return nodes[0]!;
  return ['c', ...nodes];
}

/**
 * Compile one ICU MessageFormat 1 message.
 *
 * @param icu The message, in ICU MessageFormat 1 syntax
 * @returns The compiled message
 * @throws If the message is not valid ICU MessageFormat 1
 */
export function compileMessage(icu: string): Message {
  /**
   * Build the node for a `{arg, type, style}` placeholder.
   *
   * A style that cannot be read does not fail the message: the argument falls
   * back to its bare formatter, so `{n, number, bogus}` still writes a number.
   * A slightly wrong shape beats rendering nothing.
   */
  function argument(token: FunctionArg): Message {
    const value = reference(token.arg);

    let style = '';
    for (const part of token.param ?? []) {
      // Only literal text can be read here: a placeholder nested in a style has
      // no value until the message is called
      if (part.type !== 'content') throw new Error(`Unsupported style part: ${part.type}`);
      style += part.value;
    }
    style = style.trim();

    /** Resolve a style, falling back to the type's default if it will not. */
    const resolve = <T>(read: (style: string) => T, fallback: () => T) => {
      try {
        return read(style);
      } catch (error) {
        if (!(error instanceof StyleError)) throw error;
        return fallback();
      }
    };

    switch (token.key) {
      case 'date':
      case 'time': {
        const options = resolve(
          (s) => dateTimeStyle(token.key as 'date' | 'time', s),
          () => dateTimeStyle(token.key as 'date' | 'time', ''),
        );
        return ['f', 'datetime', value, options];
      }

      case 'number': {
        const { scale, ...options } = resolve<NumberOptions>(numberStyle, () => ({}));
        // `Intl` has no option for a scale, so it stays what it is: a
        // multiplier on the value
        const scaled: Message = scale === undefined ? value : ['*', value, scale];
        return Object.keys(options).length === 0
          ? ['f', 'number', scaled]
          : ['f', 'number', scaled, options];
      }

      case 'duration':
        return ['f', 'duration', value];

      // An argument type we have no formatter for still writes its value
      default:
        return value;
    }
  }

  /**
   * Build the conditional for a `plural`, `selectordinal` or `select`.
   *
   * @param hash The node a `#` in scope prints, if any
   */
  function choice(token: Select, hash: Message | null): Message {
    const value = reference(token.arg);
    const offset = token.pluralOffset ?? 0;
    // ponytail: a plural offset on a `bigint` count throws, since the two
    // cannot be subtracted. Coerce here if one ever turns up
    const shifted: Message = offset === 0 ? value : ['-', value, offset];

    // A `#` inside a `select` still refers to the plural enclosing it; inside a
    // plural it refers to that plural's own offset value
    const inner = token.type === 'select' ? hash : shifted;

    let fallback: Message = '';
    const arms: { exact: boolean; test: Message; value: Message }[] = [];

    for (const branch of token.cases) {
      const written = pattern(branch.tokens, inner);

      if (branch.key === 'other') {
        fallback = written;
        continue;
      }

      if (token.type === 'select') {
        // A select matches its cases as literal strings, and the selector may
        // be written as a number
        arms.push({ exact: false, test: ['=', ['s', value], branch.key], value: written });
        continue;
      }

      if (EXACT.test(branch.key)) {
        // Matched against the number as written, before the offset, so `=1`
        // still means one
        arms.push({
          exact: true,
          test: ['=', value, Number(branch.key.slice(1))],
          value: written,
        });
        continue;
      }

      const category: Message =
        token.type === 'selectordinal'
          ? ['f', 'plural', shifted, 'ordinal']
          : ['f', 'plural', shifted];
      arms.push({ exact: false, test: ['=', category, branch.key], value: written });
    }

    // An exact case beats a category, however the message writes them
    const ordered = [...arms.filter((a) => a.exact), ...arms.filter((a) => !a.exact)];

    return ordered.reduceRight<Message>((rest, arm) => ['?', arm.test, arm.value, rest], fallback);
  }

  /** One token, as the node it contributes. */
  function fragment(token: Token, hash: Message | null): Message {
    switch (token.type) {
      case 'content':
        return token.value;
      case 'argument':
        return reference(token.arg);
      case 'function':
        return argument(token);
      case 'octothorpe':
        // The parser only makes a `#` a token when a plural encloses it
        /* v8 ignore next */
        return hash ? ['f', 'number', hash] : '#';
      default:
        return choice(token, hash);
    }
  }

  /** A run of tokens, as one node. */
  function pattern(tokens: Token[], hash: Message | null): Message {
    return concat(tokens.map((token) => fragment(token, hash)));
  }

  return pattern(parse(icu) as Token[], null);
}
