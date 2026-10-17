import { getDateTimeFormatOptions, parseDateTokens } from '@messageformat/date-skeleton';
import {
  getNumberFormatOptions,
  parseNumberPattern,
  parseNumberSkeleton,
} from '@messageformat/number-skeleton';

/**
 * Argument styles: which ones a macro may author, and the `Intl` options each
 * resolves to.
 *
 * Both skeleton parsers emit `Intl` option bags, which is what the compiler
 * wants anyway, so a style resolves straight to one and is written into the
 * compiled message as a literal. Nothing resolves a style at runtime.
 *
 * Checking a style and compiling one are the same work, done by the same
 * functions, so a style the transform accepts is a style the compiler honours.
 */

/**
 * The ICU argument types a macro can author, and the named styles each accepts.
 *
 * A style may also be a skeleton, which is where the formats these names have
 * no word for live; see {@link validateArgumentStyle}.
 *
 * `currency` is deliberately absent from `number`: MF1 has nowhere to write the
 * code, so `{price, number, currency}` formats as a bare number. Currency
 * belongs to a skeleton, `::currency/EUR`, which the formatter does honour.
 *
 * `duration`, `spellout`, RBNF `ordinal` and `choice` are absent by decision:
 * the first three have no `Intl` equivalent, and the last is deprecated in ICU
 * itself in favour of `plural`. A catalogue that writes one anyway compiles it
 * to the bare value.
 */
export const ARGUMENT_STYLES = {
  number: ['integer', 'percent'],
  date: ['short', 'medium', 'long', 'full'],
  time: ['short', 'medium', 'long', 'full'],
} as const;

export type ArgumentType = keyof typeof ARGUMENT_STYLES;

export const ARGUMENT_TYPES = Object.keys(ARGUMENT_STYLES) as ArgumentType[];

export function isArgumentType(kind: string): kind is ArgumentType {
  return Object.hasOwn(ARGUMENT_STYLES, kind);
}

/** The extra key a number's bag may carry, which `Intl` has no option for. */
export type NumberOptions = Intl.NumberFormatOptions & { scale?: number };

/** A style that could not be resolved, with the reason it could not. */
export class StyleError extends Error {}

/**
 * An ICU skeleton: a `::`-prefixed description of the parts a value is written
 * with, rather than a name for a whole format.
 */
const SKELETON = '::';

/**
 * A literal `NumberFormat` pattern, e.g. `#,##0.00`.
 *
 * A pattern has to carry a digit placeholder, `#` or `0`, since that is what
 * makes it a pattern rather than a word. Without it any brace-free string
 * qualifies, readmitting the named styles this module exists to reject:
 * `currency` would sail through as a "pattern", and so would a typo.
 *
 * Braces are excluded separately, since a style carrying one would close the
 * ICU argument early and take the rest of the message with it.
 */
const LITERAL_STYLE_PATTERN = /^[^{}\r\n]*[#0][^{}\r\n]*$/;

/**
 * ICU's named date lengths, as the fields each one shows.
 *
 * MF1 names a length and leaves the fields to the locale; `Intl` wants both, so
 * the names expand here. `full` and `long` differ only in the weekday, as in
 * CLDR's own patterns.
 */
const DATE_STYLES = {
  short: { year: 'numeric', month: 'numeric', day: 'numeric' },
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
  full: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

const TIME_STYLES = {
  short: { hour: 'numeric', minute: 'numeric' },
  medium: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
  long: { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' },
  full: { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'long' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/**
 * Turn a `date` or `time` argument style into `Intl.DateTimeFormat` options.
 *
 * A `::`-prefixed style is an ICU skeleton such as `::yyyyMMdd` or `::HHmm`,
 * naming the fields to show and leaving their arrangement to the locale. The named
 * styles are looked up instead, and an empty style takes MF1's own default.
 *
 * @throws {StyleError} If the style names no fields
 */
export function dateTimeStyle(kind: 'date' | 'time', style: string): Intl.DateTimeFormatOptions {
  const named = kind === 'date' ? DATE_STYLES : TIME_STYLES;

  if (style.startsWith(SKELETON)) {
    const errors: string[] = [];
    const tokens = parseDateTokens(style.slice(SKELETON.length));
    const opt = getDateTimeFormatOptions(tokens, (_type, message) => errors.push(message));
    // Any field `Intl` could not show fails the whole skeleton: a `::yMMMdqqqq`
    // that quietly drops its quarter is the silent misformat this module
    // exists to prevent
    if (errors.length > 0) throw new StyleError(errors[0]!);
    // Every token resolved and none of them named a field
    if (Object.keys(opt).length === 0) throw new StyleError('it names no fields');
    return opt;
  }

  // MF1's own default, for both `date` and `time`, is `medium`
  if (style === '') return named.medium;
  // `hasOwn` rather than `in`: the styles come from a plain object, so a key
  // every object inherits must not pass for one an author asked for
  if (Object.hasOwn(named, style)) return named[style as keyof typeof named];
  throw new StyleError(`Unsupported ${kind} style ${style}`);
}

/**
 * Turn a `number` argument style into `Intl.NumberFormat` options.
 *
 * Three forms reach here: MF1's named styles, a `::`-prefixed skeleton, and a
 * literal pattern such as `#,##0.00`.
 *
 * The named styles are expanded here rather than handed to a parser, since
 * neither recognises them: they are MF1 vocabulary, and the pattern parser
 * reads `percent` as seven literal characters. `currency` is not among them,
 * because MF1 has nowhere to write the code, `::currency/EUR` asks for one.
 *
 * `scale` comes back out alongside the bag rather than inside it, because it
 * multiplies the value and `Intl` has no option for that.
 *
 * @throws {StyleError} If the style is not valid, or asks for something `Intl`
 *   cannot express
 */
export function numberStyle(style: string): NumberOptions {
  if (style === '') return {};
  if (style === 'integer') return { maximumFractionDigits: 0 };
  // `Intl` scales a percent itself, so this is the whole of ICU's
  // `scale/100 percent`
  if (style === 'percent') return { style: 'percent' };
  if (style === SKELETON) throw new StyleError('it names no fields');

  const errors: string[] = [];
  const onError = (error: unknown) => errors.push(String(error));

  // `parseNumberPattern` wants a currency code for the `¤` token, which a
  // pattern without one never uses. `XXX` is ISO 4217's "no currency"
  const skeleton = style.startsWith(SKELETON)
    ? parseNumberSkeleton(style.slice(SKELETON.length), onError)
    : parseNumberPattern(style, 'XXX', onError);

  let scale: number | undefined;
  const opt: Intl.NumberFormatOptions = getNumberFormatOptions(skeleton, (stem, option) => {
    if (stem === 'scale') scale = Number(option);
    else errors.push(`unsupported stem '${stem}'`);
  });

  if (errors.length > 0) throw new StyleError(errors[0]!);

  // No double-scaling: `percent scale/100` is the one scale `Intl` expresses,
  // and the parser folds it into `style: 'percent'` rather than reporting it
  return scale === undefined ? opt : { ...opt, scale };
}

/**
 * Reject an argument style the compiler cannot honour, while the style is
 * still attached to a file and a line.
 *
 * A style is a bare string in the source and in the catalogue, so nothing
 * between here and the compiler has an opinion about it. The compiler falls
 * back to a type's default format when a style does not resolve, so left
 * unchecked a typo like `{d, date, meduim}` only misformats once it reaches a
 * user.
 *
 * Three forms are accepted: a named style, a `::`-prefixed skeleton, and, for
 * a number, a literal pattern such as `#,##0.00`. A skeleton or a pattern is
 * open-ended, so it is checked by resolving it exactly as the compiler will.
 */
export function validateArgumentStyle(type: ArgumentType, style: string) {
  const named: readonly string[] = ARGUMENT_STYLES[type];
  if (named.includes(style)) return;

  const skeleton = style.startsWith(SKELETON);
  if (skeleton || (type === 'number' && LITERAL_STYLE_PATTERN.test(style))) {
    try {
      if (type === 'number') numberStyle(style);
      else dateTimeStyle(type, style);
      return;
    } catch (error) {
      if (!(error instanceof StyleError)) throw error;
      const what = skeleton ? 'skeleton' : 'pattern';
      throw new Error(`Invalid ${type} ${what} '${style}': ${error.message}`);
    }
  }

  const expected = named.map((s) => `'${s}'`).join(', ');
  throw new Error(
    `Invalid ${type} style '${style}', expected ${expected}, or a skeleton such as ` +
      (type === 'number' ? '::currency/EUR' : '::yyyyMMdd') +
      (type === 'number' ? ', or a literal number pattern such as #,##0.00' : ''),
  );
}
