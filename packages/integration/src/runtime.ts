/** The `Intl` objects a compiled message formats with, and the coercions that read a value before it reaches one. */

/** `Intl` objects, kept by kind, locale and options, since constructing one is the expensive part. */
const formatters = new Map<string, unknown>();

function memoise<T>(key: string, make: () => T) {
  let formatter = formatters.get(key) as T | undefined;
  if (formatter === undefined) formatters.set(key, (formatter = make()));
  return formatter;
}

/** The formatter that writes a number the way `locale` writes one. */
export function numberFormat(locale: string, options?: Intl.NumberFormatOptions) {
  return memoise(
    `n${locale}${JSON.stringify(options ?? null)}`,
    () => new Intl.NumberFormat(locale, options),
  );
}

/** The formatter that writes a date or a time the way `locale` writes one. */
export function dateTimeFormat(locale: string, options?: Intl.DateTimeFormatOptions) {
  return memoise(
    `d${locale}${JSON.stringify(options ?? null)}`,
    () => new Intl.DateTimeFormat(locale, options),
  );
}

/** The rules that pick a CLDR plural category for `locale`. */
export function pluralRules(locale: string, type: Intl.PluralRuleType) {
  return memoise(`p${locale}${type}`, () => new Intl.PluralRules(locale, { type }));
}

/**
 * Read a value as a number, keeping a bigint a bigint.
 *
 * A wrapper is unwrapped and a numeric string is read, so `'3'` formats as 3.
 *
 * @returns The number, or `undefined` if the value is not one
 */
export function toNumeric(value: unknown): number | bigint | undefined {
  const raw = typeof value === 'object' && value !== null ? value.valueOf() : value;
  if (typeof raw === 'bigint') return raw;
  if (raw === null || raw === '') return undefined;
  const number = Number(raw);
  return Number.isNaN(number) ? undefined : number;
}

/**
 * Read a value as a date: a `Date`, an epoch offset, or anything `Date` parses.
 *
 * @returns The date, or `undefined` if the value is not a valid one
 */
export function toDate(value: unknown): Date | undefined {
  let raw = value;
  if (typeof raw === 'object' && raw !== null && !(raw instanceof Date)) raw = raw.valueOf();
  if (typeof raw === 'number' || typeof raw === 'string') raw = new Date(raw);
  return raw instanceof Date && !Number.isNaN(raw.getTime()) ? raw : undefined;
}
