import { dateTimeFormat, numberFormat, pluralRules, toDate, toNumeric } from './runtime.js';

/**
 * What each node in a compiled message is, by the number it starts with.
 *
 * The numbers are the format: a catalogue compiled by one version is read by
 * another, so a kind is only ever appended, and none is renumbered or reused.
 */
export const Kind = {
  Value: 0,
  Number: 1,
  DateTime: 2,
  Plural: 3,
  Ordinal: 4,
  Select: 5,
  Hash: 6,
} as const;

export type Kind = (typeof Kind)[keyof typeof Kind];

/**
 * A compiled message.
 *
 * The CLI compiles a catalogue's messages down to this: arrays and strings,
 * with every style already resolved to the options bag it stands for. Nothing
 * here is parsed at runtime, and nothing here is a function, so a locale's
 * messages are data - they cross a server/client boundary the way any other
 * JSON does, which a compiled function cannot.
 *
 * A node is an array that starts with its {@link Kind}, and an array that
 * starts with anything else is a concatenation. Each operand is the descriptor
 * key it reads from, never a node, since a placeholder only ever reads a value.
 *
 * A message with no placeholders is its own string, so the common case costs
 * nothing at all.
 */
export type Message =
  // Literal text
  | string
  // Concatenation: the parts of one message, in order
  | Message[]
  // A value from the descriptor, by key
  | [typeof Kind.Value, string]
  // A number, with its `Intl` options and a multiplier `Intl` has no option for
  | [typeof Kind.Number, string, Intl.NumberFormatOptions?, number?]
  // A date or a time, with its `Intl` options
  | [typeof Kind.DateTime, string, Intl.DateTimeFormatOptions?]
  // A cardinal plural: the value, its cases, and the offset
  | [typeof Kind.Plural, string, Message.Cases, number?]
  // An ordinal plural: the value, its cases, and the offset
  | [typeof Kind.Ordinal, string, Message.Cases, number?]
  // A select: the value and its cases, matched as text
  | [typeof Kind.Select, string, Message.Cases]
  // The number the enclosing plural selected on, less its offset, formatted
  | [typeof Kind.Hash];

export namespace Message {
  /**
   * A plural's or a select's branches, by key. A plural's keys are CLDR
   * categories or an exact `=n`, and `other` is the fallback for both.
   */
  export type Cases = { [key: string]: Message };

  /** What a compiled message is called with: the descriptor the transform built. */
  export type Values = Record<string, unknown>;
}

type Formatter = (values: Message.Values) => unknown;

/** What every node in one message is built against. */
interface Context {
  locale: string;
  /** The locale's direction, or `undefined` when values are not isolated. */
  dir: 'ltr' | 'rtl' | 'auto' | undefined;
  /** The enclosing plural's offset number, for a `#` to write. */
  hash: Formatter | undefined;
}

// First strong and right-to-left isolates, and the pop that ends each. Written
// as code points, since the characters are invisible. A left-to-right isolate
// is never needed: a localised value only ever runs in its locale's direction
const FSI = String.fromCharCode(0x2068);
const RLI = String.fromCharCode(0x2067);
const PDI = String.fromCharCode(0x2069);

// Scripts written right to left, from CLDR's script metadata
const RTL = new Set(['Adlm', 'Arab', 'Hebr', 'Mand', 'Nkoo', 'Rohg', 'Syrc', 'Thaa']);

function localeDir(locale: string): 'ltr' | 'rtl' | 'auto' {
  try {
    const script = new Intl.Locale(locale).maximize().script;
    if (script) return RTL.has(script) ? 'rtl' : 'ltr';
  } catch {
    // An unknown locale has no direction to go on
  }
  return 'auto';
}

/**
 * Isolate a written value the way MessageFormat 2 does by default.
 *
 * A number or a date is written in the locale's own direction, so in a
 * left-to-right message it needs nothing and otherwise takes that direction's
 * isolate. Anything else could be in any script, so it is isolated by its
 * first strong character.
 */
function isolate(ctx: Context, written: string, localised: boolean) {
  if (!ctx.dir) return written;
  if (!localised) return FSI + written + PDI;
  if (ctx.dir === 'ltr') return written;
  return (ctx.dir === 'rtl' ? RLI : FSI) + written + PDI;
}

/**
 * Report a value a message could not format, which is then written as given.
 *
 * A message never throws over a value: a bad date in one placeholder should
 * not take the rest of the page down with it.
 */
function unformattable(kind: string, value: unknown, error?: unknown) {
  console.warn(`saykit: cannot format ${String(value)} as a ${kind}`, ...(error ? [error] : []));
  return String(value);
}

/**
 * Build an `Intl` object for a message, once, when the message is built.
 *
 * Construction can fail on options a skeleton allowed but this engine does
 * not, such as an unknown currency; the message then writes its values as
 * given rather than failing on every call.
 */
function prepare<T>(kind: string, make: () => T): T | undefined {
  try {
    return make();
  } catch (error) {
    console.warn(`saykit: cannot build a ${kind} formatter`, error);
    return undefined;
  }
}

/** The closure that formats a number, as a placeholder or as a `#`. */
function formatNumber(
  ctx: Context,
  value: Formatter,
  out: boolean,
  options?: Intl.NumberFormatOptions,
  scale?: number,
): Formatter {
  const format = prepare('number', () => numberFormat(ctx.locale, options));

  return (values) => {
    const raw = value(values);
    if (raw === undefined) return undefined;

    const number = toNumeric(raw);
    if (number === undefined || !format) return unformattable('number', raw);

    let scaled = number;
    if (scale !== undefined)
      // A bigint keeps its precision through a whole-number scale only
      scaled =
        typeof number === 'bigint' && Number.isInteger(scale)
          ? number * BigInt(scale)
          : Number(number) * scale;

    return out ? isolate(ctx, format.format(scaled), true) : format.format(scaled);
  };
}

/** A plural's or a select's cases, built, with `other` split out as the fallback. */
function arms(cases: Message.Cases, ctx: Context, out: boolean) {
  const built = new Map<string, Formatter>();
  for (const [key, node] of Object.entries(cases)) built.set(key, build(node, ctx, out));
  const other = built.get('other');
  return { built, other };
}

/**
 * Build the closure one node evaluates to.
 *
 * The walk happens once per message, and every branch of it resolves what it
 * can while it walks: an `Intl` object is built here rather than per call, and
 * so are a plural's or a select's cases. What is left at call time is the work
 * that depends on the values.
 *
 * `out` is set where a node's result is written into the message, rather than
 * selected on or formatted, which is the only place a value is isolated.
 */
function build(node: Message, ctx: Context, out: boolean): Formatter {
  if (typeof node === 'string') return () => node;

  if (typeof node[0] !== 'number') {
    const parts = (node as Message[]).map((part) => build(part, ctx, out));
    return (values) => {
      let written = '';
      for (const part of parts) written += part(values) ?? '';
      return written;
    };
  }

  // Every operand is a descriptor key, read as is
  const read =
    (key: string): Formatter =>
    (values) =>
      values[key];

  switch (node[0]) {
    case Kind.Value: {
      const key = node[1];
      if (!out) return read(key);
      // Written as text whether or not it is isolated, so turning isolation
      // off changes the marks around a value and nothing else
      return (values) => {
        const value = values[key];
        return value === undefined ? value : isolate(ctx, String(value), false);
      };
    }

    case Kind.Number:
      return formatNumber(ctx, read(node[1]), out, node[2], node[3]);

    case Kind.DateTime: {
      const value = read(node[1]);
      const format = prepare('date', () => dateTimeFormat(ctx.locale, node[2]));
      return (values) => {
        const raw = value(values);
        if (raw === undefined) return undefined;
        const date = toDate(raw);
        if (!date || !format) return unformattable('date', raw);
        return out ? isolate(ctx, format.format(date), true) : format.format(date);
      };
    }

    case Kind.Plural:
    case Kind.Ordinal: {
      const value = read(node[1]);
      const offset = node[3] ?? 0;
      const rules = pluralRules(ctx.locale, node[0] === Kind.Ordinal ? 'ordinal' : 'cardinal');

      const shift = (number: number | bigint) =>
        offset === 0
          ? number
          : typeof number === 'bigint'
            ? number - BigInt(offset)
            : number - offset;

      // A `#` in any case writes this plural's number, less its offset
      const hash: Formatter = (values) => {
        const number = toNumeric(value(values));
        return number === undefined ? undefined : shift(number);
      };
      const { built, other } = arms(node[2], { ...ctx, hash }, out);

      return (values) => {
        const number = toNumeric(value(values));
        let arm: Formatter | undefined;
        if (number !== undefined) {
          // An exact case is matched against the number as given, before the
          // offset, so `=1` still means one. The category is chosen after it
          arm = built.get(`=${String(number)}`);
          // `Intl.PluralRules` takes a number, never a bigint
          arm ??= built.get(rules.select(Number(shift(number))));
        }
        return (arm ?? other)?.(values);
      };
    }

    case Kind.Select: {
      const value = read(node[1]);
      const { built, other } = arms(node[2], ctx, out);
      return (values) => {
        const raw = value(values);
        const arm = raw === undefined ? undefined : built.get(String(raw));
        return (arm ?? other)?.(values);
      };
    }

    default: {
      // Only a plural makes a `#` a node, so one outside it is text
      if (!ctx.hash) return () => '#';
      return formatNumber(ctx, ctx.hash, out);
    }
  }
}

/**
 * Compile one message into the function that formats it.
 *
 * Called once per message per locale: a view memoises what this returns, so a
 * message walked here is called from the closure afterwards.
 *
 * @param message The compiled message, as the CLI emitted it
 * @param locale The locale to format in
 * @param options Whether written values are wrapped in bidi isolation marks
 * @returns A function from a descriptor to the formatted string
 */
export function compileMessage(
  message: Message,
  locale: string,
  options: { bidiIsolation?: 'default' | 'none' } = {},
): (values: Message.Values) => string {
  // A message with no placeholders is already its own answer
  if (typeof message === 'string') return () => message;

  const dir = options.bidiIsolation === 'none' ? undefined : localeDir(locale);
  const formatter = build(message, { locale, dir, hash: undefined }, true);
  return (values) => String(formatter(values) ?? '');
}
