/**
 * What a compiled message calls.
 *
 * An `'f'` node names one of these, and every style it uses was resolved when
 * it was compiled, so these are the last step and nothing else: hand an
 * already-built `Intl` object a value.
 *
 * Nothing here parses anything, which is the point of the whole arrangement.
 */

/**
 * `Intl` objects, kept by locale and options.
 *
 * Constructing one is the expensive half of formatting, and a message formats
 * the same way every time it is called, so the object outlives the call.
 */
const formatters = new Map<string, unknown>();

function memoise<T>(key: string, make: () => T) {
  let formatter = formatters.get(key) as T | undefined;
  if (formatter === undefined) formatters.set(key, (formatter = make()));
  return formatter;
}

/** Format a number the way `locale` writes one. */
export function number(locale: string, value: number | bigint, options?: Intl.NumberFormatOptions) {
  const key = `n${locale}${JSON.stringify(options ?? null)}`;
  return memoise(key, () => new Intl.NumberFormat(locale, options)).format(value);
}

/** Format a date or a time the way `locale` writes one. */
export function datetime(
  locale: string,
  value: Date | number,
  options?: Intl.DateTimeFormatOptions,
) {
  const key = `d${locale}${JSON.stringify(options ?? null)}`;
  return memoise(key, () => new Intl.DateTimeFormat(locale, options)).format(value);
}

/** The CLDR plural category `value` falls in, for `locale`. */
export function plural(
  locale: string,
  value: number | bigint,
  type: Intl.PluralRuleType = 'cardinal',
) {
  const key = `p${locale}${type}`;
  // `Intl.PluralRules` takes a number, never a bigint
  return memoise(key, () => new Intl.PluralRules(locale, { type })).select(Number(value));
}

/**
 * `hhhh:mm:ss`, MF1's `duration` argument type.
 *
 * `Intl` has no equivalent, since `DurationFormat` writes "1 hr, 2 min" rather
 * than a clock reading, so this is the one format written out by hand.
 */
export function duration(value: number) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return String(seconds);

  const sign = seconds < 0 ? '-' : '';

  // Round to the millisecond *before* splitting the value up: a seconds field
  // of 59.9999 rounds to `60`, which has to carry into the minutes
  const total = Math.round(Math.abs(seconds) * 1000) / 1000;

  const secs = total % 60;
  const minutes = Math.floor(total / 60);
  const hours = Math.floor(minutes / 60);

  // A fractional second stays a string from here on, since `Number('1.500')`
  // would undo the rounding
  const written = Math.round(secs) === secs ? String(secs) : secs.toFixed(3);

  // One `:` is always written, so a sub-minute duration still reads as one
  const parts: (string | number)[] =
    hours > 0 ? [hours, minutes % 60, written] : [minutes, written];

  // Every part but the first is padded to two digits: `1:01:01`, never
  // `01:01:01`. Judged from the value, so `1.500` pads like the 1 it is
  const first = parts.shift()!;
  const pad = (n: string | number) => (Number(n) < 10 ? `0${n}` : String(n));
  return sign + [first, ...parts.map(pad)].join(':');
}
