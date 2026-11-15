import { getDateTimeFormatOptions, parseDateTokens } from '@messageformat/date-skeleton';
import {
  getNumberFormatOptions,
  parseNumberPattern,
  parseNumberSkeleton,
} from '@messageformat/number-skeleton';

/**
 * Argument styles: which ones a macro may author, and the `Intl` options each resolves to.
 *
 * Validation and compilation share these functions, so a style the transform accepts is one the
 * compiler honours.
 */

/**
 * The ICU argument types a macro can author, and the named styles each accepts.
 *
 * `currency` is absent from `number` because MF1 has nowhere to write the code; use
 * `::currency/EUR`.
 * `duration`, `spellout`, RBNF `ordinal` and `choice` are absent too, and compile to the bare
 * value.
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

/** The prefix of an ICU skeleton, which describes the parts a value is written with. */
const SKELETON = '::';

/**
 * A literal `NumberFormat` pattern, e.g. `#,##0.00`.
 *
 * It needs a `#` or `0`, or a typo like `currency` would pass as a pattern. Braces would close the
 * argument early.
 */
const LITERAL_STYLE_PATTERN = /^[^{}\r\n]*[#0][^{}\r\n]*$/;

/** ICU's named date lengths, expanded to the fields `Intl` wants. */
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
 * A `::`-prefixed style is a skeleton such as `::yyyyMMdd`; an empty style takes MF1's default.
 *
 * @throws {StyleError} If the style names no fields
 */
export function dateTimeStyle(kind: 'date' | 'time', style: string): Intl.DateTimeFormatOptions {
  const named = kind === 'date' ? DATE_STYLES : TIME_STYLES;

  if (style.startsWith(SKELETON)) {
    const errors: string[] = [];
    const tokens = parseDateTokens(style.slice(SKELETON.length));
    const opt = getDateTimeFormatOptions(tokens, (_type, message) => errors.push(message));
    // A field `Intl` cannot show fails the skeleton rather than being silently dropped
    if (errors.length > 0) throw new StyleError(errors[0]!);
    if (Object.keys(opt).length === 0) throw new StyleError('it names no fields');
    return opt;
  }

  if (style === '') return named.medium;
  // `hasOwn` so an inherited key like `constructor` is not taken for a style
  if (Object.hasOwn(named, style)) return named[style as keyof typeof named];
  throw new StyleError(`Unsupported ${kind} style ${style}`);
}

/**
 * Turn a `number` argument style into `Intl.NumberFormat` options.
 *
 * Accepts MF1's named styles, a `::`-prefixed skeleton, or a literal pattern such as `#,##0.00`.
 * Named styles are expanded here because the pattern parser would read `percent` as literal text.
 *
 * `scale` comes back beside the bag, since `Intl` has no option for it.
 *
 * @throws {StyleError} If the style is not valid, or asks for something `Intl` cannot express
 */
export function numberStyle(style: string): NumberOptions {
  if (style === '') return {};
  if (style === 'integer') return { maximumFractionDigits: 0 };
  // `Intl` scales a percent itself
  if (style === 'percent') return { style: 'percent' };
  if (style === SKELETON) throw new StyleError('it names no fields');

  const errors: string[] = [];
  const onError = (error: unknown) => errors.push(String(error));

  // `parseNumberPattern` requires a currency code; `XXX` is ISO 4217's "no currency"
  const skeleton = style.startsWith(SKELETON)
    ? parseNumberSkeleton(style.slice(SKELETON.length), onError)
    : parseNumberPattern(style, 'XXX', onError);

  let scale: number | undefined;
  const opt: Intl.NumberFormatOptions = getNumberFormatOptions(skeleton, (stem, option) => {
    if (stem === 'scale') scale = Number(option);
    else errors.push(`unsupported stem '${stem}'`);
  });

  if (errors.length > 0) throw new StyleError(errors[0]!);

  // The parser folds `percent scale/100` into `style: 'percent'`, so it never reaches `scale`
  return scale === undefined ? opt : { ...opt, scale };
}

/**
 * Reject an argument style the compiler cannot honour, while it is still attached to a file and
 * line.
 *
 * The compiler falls back to the default format, so an unchecked typo like `{d, date, meduim}` only
 * misformats in production.
 * Skeletons and patterns are checked by resolving them as the compiler will.
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
