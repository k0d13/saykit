import { parse } from '@messageformat/parser';
import { MessageFormat, type MessageFormatOptions } from 'messageformat';
import { toMessage } from './convert.js';
import { functions } from './functions.js';

/**
 * ICU MessageFormat 1, compiled in-tree.
 *
 * `@messageformat/icu-messageformat-1` does this already, and this folder owes
 * it the select-flattening in `convert.ts`. What it cannot do is a skeleton on
 * a date: it renders a style into MF2's own option vocabulary, which has no
 * room for one, so `{d, date, ::yyyyMMdd}` arrives as an unrecognised
 * `mf1:argStyle` and renders as a fallback.
 *
 * Owning the conversion lets a style skip that vocabulary. A skeleton resolves
 * to an `Intl` options bag while the message is compiled and is carried whole
 * to format time, so `::yyyyMMdd` arrives by the same route as `short`.
 *
 * The pipeline reads in one direction:
 *
 * - `styles.ts`: an argument style becomes `Intl` options
 * - `options.ts`: the seam those options travel through
 * - `convert.ts`: the MF1 tree becomes an MF2 message
 * - `values.ts` / `functions.ts`: what the formatter runs
 */

/**
 * Compile an ICU MessageFormat 1 message for a locale.
 *
 * @param locale Locale to format in
 * @param source The message, in ICU MessageFormat 1 syntax
 * @param options Whether substituted values are wrapped in bidi isolation marks
 * @returns A formatter for the message
 * @throws If the message is not valid ICU MessageFormat 1
 */
export function compile(
  locale: string,
  source: string,
  options?: Pick<MessageFormatOptions, 'bidiIsolation'>,
) {
  return new MessageFormat(locale, toMessage(parse(source)), { ...options, functions });
}
