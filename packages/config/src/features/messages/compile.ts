import {
  type Content,
  type FunctionArg,
  type Octothorpe,
  parse,
  type PlainArg,
  type Select,
} from '@messageformat/parser';
import type { Kind as Kinds, Message } from 'saykit';
import { dateTimeStyle, type NumberOptions, numberStyle, StyleError } from './styles.js';

/**
 * ICU MessageFormat 1, compiled to a {@link Message}.
 *
 * Styles are resolved to `Intl` options here, so nothing is parsed at runtime and the
 * result is serialisable data. The locale is bound later, when a view compiles the message.
 */

/**
 * The node kinds, as `saykit` numbers them.
 *
 * `saykit` is only a dev dependency here, so this copy is type-checked against it instead of
 * imported.
 */
const Kind = {
  Value: 0,
  Number: 1,
  DateTime: 2,
  Plural: 3,
  Ordinal: 4,
  Select: 5,
  Hash: 6,
} as const satisfies typeof Kinds;

type Token = Content | PlainArg | FunctionArg | Select | Octothorpe;

/** `=3` names the number three; anything else names a CLDR category. */
const EXACT = /^=\d+$/;

/**
 * The descriptor key an ICU argument reads from.
 *
 * The transform prefixes every value with one underscore, so `{name}` reads `_name`.
 */
function key(argument: string) {
  return `_${argument}`;
}

/** A run of nodes, as one node: a single node stands alone and an empty run is `''`. */
function concat(nodes: Message[]): Message {
  if (nodes.length === 0) return '';
  if (nodes.length === 1) return nodes[0]!;
  return nodes;
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
   * A style that cannot be read falls back to the bare formatter, so `{n, number, bogus}` still
   * writes a number.
   */
  function argument(token: FunctionArg): Message {
    const value = key(token.arg);

    let style = '';
    for (const part of token.param ?? []) {
      // A placeholder nested in a style has no value until the message is called
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
        return [Kind.DateTime, value, options];
      }

      case 'number': {
        const { scale, ...options } = resolve<NumberOptions>(numberStyle, () => ({}));
        // `Intl` has no option for a scale, so it rides along as a multiplier
        if (scale !== undefined) return [Kind.Number, value, options, scale];
        return Object.keys(options).length === 0
          ? [Kind.Number, value]
          : [Kind.Number, value, options];
      }

      // `duration`, `spellout` and RBNF `ordinal` land here and write the bare value
      default:
        return [Kind.Value, value];
    }
  }

  /** Build the switch for a `plural`, `selectordinal` or `select`. */
  function choice(token: Select): Message {
    const value = key(token.arg);
    // No prototype, so a branch named `__proto__` is an ordinary key
    const cases: Message.Cases = Object.create(null);

    for (const branch of token.cases) {
      // `=01` and `=1` are the same number, and the runtime matches it as text
      const key = EXACT.test(branch.key) ? `=${Number(branch.key.slice(1))}` : branch.key;
      // The first case written for a key wins
      if (!Object.hasOwn(cases, key)) cases[key] = pattern(branch.tokens);
    }

    if (token.type === 'select') return [Kind.Select, value, cases];

    const kind = token.type === 'selectordinal' ? Kind.Ordinal : Kind.Plural;
    const offset = token.pluralOffset ?? 0;
    return offset === 0 ? [kind, value, cases] : [kind, value, cases, offset];
  }

  /** One token, as the node it contributes. */
  function fragment(token: Token): Message {
    switch (token.type) {
      case 'content':
        return token.value;
      case 'argument':
        return [Kind.Value, key(token.arg)];
      case 'function':
        return argument(token);
      case 'octothorpe':
        // A `#` in a select inside a plural still writes the plural's number
        return [Kind.Hash];
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
