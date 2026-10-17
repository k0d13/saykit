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
 * over the `Intl` objects it names, and nothing parses anything at runtime.
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
        const kind = token.key;
        const options = resolve(
          (s) => dateTimeStyle(kind, s),
          () => dateTimeStyle(kind, ''),
        );
        return ['d', value, options];
      }

      case 'number': {
        const { scale, ...options } = resolve<NumberOptions>(numberStyle, () => ({}));
        // `Intl` has no option for a scale, so it rides along as a multiplier
        if (scale !== undefined) return ['n', value, options, scale];
        return Object.keys(options).length === 0 ? ['n', value] : ['n', value, options];
      }

      // An argument type we have no formatter for still writes its value.
      // `duration`, `spellout` and RBNF `ordinal` land here: no macro authors
      // them, and `Intl` has nothing to write them with
      default:
        return value;
    }
  }

  /** Build the switch for a `plural`, `selectordinal` or `select`. */
  function choice(token: Select): Message {
    const value = reference(token.arg);
    const cases: Message.Cases = {};

    for (const branch of token.cases) {
      // `=01` and `=1` name the same number, and the runtime matches the
      // number as text, so the key is written the one way it is looked up
      const key = EXACT.test(branch.key) ? `=${Number(branch.key.slice(1))}` : branch.key;
      // The first case written for a key wins, as it would in a chain of tests
      if (!Object.hasOwn(cases, key)) cases[key] = pattern(branch.tokens);
    }

    if (token.type === 'select') return ['s', value, cases];

    const offset = token.pluralOffset ?? 0;
    if (token.type === 'selectordinal') return ['p', value, cases, offset, 1];
    return offset === 0 ? ['p', value, cases] : ['p', value, cases, offset];
  }

  /** One token, as the node it contributes. */
  function fragment(token: Token): Message {
    switch (token.type) {
      case 'content':
        return token.value;
      case 'argument':
        return reference(token.arg);
      case 'function':
        return argument(token);
      case 'octothorpe':
        // The parser only makes a `#` a token when a plural encloses it, and a
        // `#` in a select inside that plural still writes the plural's number
        return ['#'];
      default:
        return choice(token);
    }
  }

  /** A run of tokens, as one node. */
  function pattern(tokens: Token[]): Message {
    return concat(tokens.map(fragment));
  }

  return pattern(parse(icu) as Token[]);
}
