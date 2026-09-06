import { getDateTimeFormatOptions, parseDateTokens } from '@messageformat/date-skeleton';
import {
  getNumberFormatOptions,
  parseNumberPattern,
  parseNumberSkeleton,
} from '@messageformat/number-skeleton';
/**
 * An argument style, resolved to the `Intl` options it asks for.
 *
 * Both skeleton parsers emit `Intl` option bags, which is what the compiler
 * wants anyway, so a style resolves straight to one and is written into the
 * generated function as a literal. Nothing resolves a style at runtime.
 */

/** The extra key a number's bag may carry, which `Intl` has no option for. */
export type NumberOptions = Intl.NumberFormatOptions & { scale?: number };

/** A style the conversion could not read. */
export class StyleError extends Error {}

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

  if (style.startsWith('::')) {
    const errors: string[] = [];
    const tokens = parseDateTokens(style.slice(2));
    const opt = getDateTimeFormatOptions(tokens, (_type, message) => errors.push(message));
    // Any field `Intl` could not show fails the whole skeleton: a `::yMMMdqqqq`
    // that quietly drops its quarter is the silent misformat this module
    // exists to prevent
    if (errors.length > 0) throw new StyleError(errors[0]!);
    // Every token resolved and none of them named a field
    if (Object.keys(opt).length === 0) throw new StyleError(`Empty skeleton ${style}`);
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

  const errors: string[] = [];
  const onError = (error: unknown) => errors.push(String(error));

  // `parseNumberPattern` wants a currency code for the `¤` token, which a
  // pattern without one never uses. `XXX` is ISO 4217's "no currency"
  const skeleton = style.startsWith('::')
    ? parseNumberSkeleton(style.slice(2), onError)
    : parseNumberPattern(style, 'XXX', onError);

  let scale: number | undefined;
  const opt: Intl.NumberFormatOptions = getNumberFormatOptions(skeleton, (stem, option) => {
    if (stem === 'scale') scale = Number(option);
    else errors.push(`Unsupported number stem ${stem}`);
  });

  if (errors.length > 0) throw new StyleError(errors[0]!);

  // No double-scaling: `percent scale/100` is the one scale `Intl` expresses,
  // and the parser folds it into `style: 'percent'` rather than reporting it
  return scale === undefined ? opt : { ...opt, scale };
}
