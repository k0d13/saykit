import { compile } from './messageformat/index.js';
import type {
  DateTimeOptions,
  Disallow,
  Named,
  NumberOptions,
  NumeralOptions,
  SelectOptions,
} from './types.js';

/**
 * Map a descriptor's keys back to the placeholders the message names. The
 * transform prefixes every value with one underscore, so stripping exactly one
 * is the inverse: `_0` is `0`, `__total` is `_total`. Keys without one pass
 * through, so a hand-written `call({ id, name })` still formats `{name}`.
 *
 * Built from own entries, so a value named `__proto__` stays a placeholder.
 */
function resolveDescriptorValues(descriptor: View.Descriptor) {
  return Object.fromEntries(
    Object.entries(descriptor)
      // The id or the message names the message, it is not one of its values
      .filter(([key]) => key !== 'id' && key !== 'message')
      .map(([key, value]) => [key.startsWith('_') ? key.slice(1) : key, value]),
  );
}

function macro(name: string): never {
  throw new Error(`'say.${name}' is a macro and must be used with the relevant saykit plugin`);
}

export namespace View {
  export type Messages = { [key: string]: string };

  /**
   * What the transform compiles a message down to: the id it was extracted
   * under, or the ICU message itself when there was nothing to extract, with
   * its values behind one underscore each.
   */
  export type Descriptor = ({ id: string } | { message: string }) & {
    [match: string | number]: unknown;
  };
}

/**
 * One locale, bound to the messages it formats against.
 *
 * Callable, immutable and memoised: `catalogue.locale('en')` hands back the
 * same value every time. A view has no reference back to its catalogue and so
 * cannot switch locale; switching belongs to whoever owns the catalogue.
 */
export interface View<Locale extends string = string> {
  // ===== Macros ===== //

  /**
   * Define a message.
   *
   * An interpolated variable is named after itself. Anything else is numbered,
   * unless written as a single-key object, which names it.
   *
   * @example
   * ```ts
   * say`Hello, ${name}!`
   * say`Your total is ${{ cartTotal: getCartTotal() }}`
   * ```
   *
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  (strings: TemplateStringsArray, ...placeholders: unknown[]): string;

  /**
   * Give the message a custom id, or a context to disambiguate identical
   * strings that mean different things.
   *
   * @example
   * ```ts
   * say({ context: 'direction' })`Right`
   * say({ context: 'correctness' })`Right`
   * ```
   *
   * @param descriptor Object containing optional `id` and `context` properties
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  (descriptor: { id?: string; context?: string }): View<Locale>;

  /** The locale this view is bound to. */
  readonly locale: Locale;

  /** The messages this view formats against. */
  readonly messages: Readonly<View.Messages>;

  /**
   * Format the message a descriptor names, or the message it carries.
   *
   * A message with nothing to translate, a lone `say.date(x)` with no text
   * around it, is never extracted: the transform writes the ICU into the call
   * instead of an id.
   *
   * @param descriptor Descriptor to format
   * @returns The formatted message
   * @throws If the id has no message
   */
  call(descriptor: View.Descriptor): string;

  /**
   * Define a pluralised message.
   *
   * Interpolating the selector into a branch extracts as ICU's `#`. A `#` you
   * write yourself is text.
   *
   * @example
   * ```ts
   * say.plural(count, {
   *   one: 'You have 1 item',
   *   other: `You have ${count} items`,
   * })
   * ```
   *
   * @param _ Number to determine the plural form of
   * @param options Pluralisation rules keyed by CLDR categories or specific numbers
   * @returns The plural form of the number
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  plural(_: number | Named<number>, options: Disallow<NumeralOptions, 'id' | 'context'>): string;

  /**
   * Define an ordinal message ("1st", "2nd", "3rd").
   *
   * Interpolating the selector into a branch extracts as ICU's `#`. A `#` you
   * write yourself is text.
   *
   * @example
   * ```ts
   * say.ordinal(position, {
   *   1: `${position}st`,
   *   2: `${position}nd`,
   *   3: `${position}rd`,
   *   other: `${position}th`,
   * })
   * ```
   *
   * @param _ Number to determine the ordinal form of
   * @param options Ordinal rules keyed by CLDR categories or specific numbers
   * @returns The ordinal form of the number
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  ordinal(_: number | Named<number>, options: Disallow<NumeralOptions, 'id' | 'context'>): string;

  /**
   * Define a select message, for gender, status, or other categories.
   *
   * @example
   * ```ts
   * say.select(gender, {
   *   male: 'He',
   *   female: 'She',
   *   other: 'They',
   * })
   * ```
   *
   * @param _ Selector value to determine which option is chosen
   * @param options A mapping of possible selector values to message strings
   * @returns The select form of the value
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  select(
    _: string | number | Named<string | number>,
    options: Disallow<SelectOptions, 'id' | 'context'>,
  ): string;

  /**
   * Format a number the way this view's locale writes one, with its own
   * grouping separators and decimal mark.
   *
   * Unlike `plural`, `ordinal` and `select`, this is a fragment rather than a
   * whole message, and is normally written inside one.
   *
   * @example
   * ```ts
   * say`You have ${say.number(items.length)} items`
   * say`Battery at ${say.number(level, { style: 'percent' })}`
   * say`Total: ${say.number({ cartTotal: getTotal() }, { style: '#,##0.00' })}`
   * say`Total: ${say.number(total, { style: '::currency/EUR' })}`
   * ```
   *
   * @param _ Number to format
   * @param options Formatting style: a named style, an ICU skeleton such as
   *   `::currency/EUR`, or a pattern such as `#,##0.00`
   * @returns The formatted number
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  number(_: number | Named<number>, options?: Disallow<NumberOptions, 'id' | 'context'>): string;

  /**
   * Format the date portion of a value the way this view's locale writes one.
   *
   * @example
   * ```ts
   * say`Published ${say.date(post.publishedAt)}`
   * say`Published ${say.date(post.publishedAt, { style: 'full' })}`
   * say`Published ${say.date(post.publishedAt, { style: '::yMMMM' })}`
   * ```
   *
   * @param _ Date to format
   * @param options A named style or an ICU skeleton such as `::yyyyMMdd`
   * @returns The formatted date
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  date(
    _: Date | number | Named<Date | number>,
    options?: Disallow<DateTimeOptions, 'id' | 'context'>,
  ): string;

  /**
   * Format the time portion of a value the way this view's locale writes one.
   *
   * @example
   * ```ts
   * say`Doors open at ${say.time(opensAt)}`
   * say`Doors open at ${say.time(opensAt, { style: 'short' })}`
   * say`Doors open at ${say.time(opensAt, { style: '::Hm' })}`
   * ```
   *
   * @param _ Date to format
   * @param options A named style or an ICU skeleton such as `::Hm`
   * @returns The formatted time
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  time(
    _: Date | number | Named<Date | number>,
    options?: Disallow<DateTimeOptions, 'id' | 'context'>,
  ): string;
}

/**
 * Create a view over one locale and the messages it formats against.
 *
 * A catalogue memoises one per locale, which is how application code usually
 * reaches one; a single-locale app can build one directly. The format cache
 * belongs to the view, so a view built over one set of messages can never be
 * served a format compiled from another.
 *
 * @param locale The locale to bind to
 * @param messages The messages this view formats against
 * @returns The view
 */
export function createView<Locale extends string>(
  locale: Locale,
  messages: View.Messages,
): View<Locale> {
  // Copied and frozen: formats are compiled once and kept, so a record that
  // could change afterwards would leave `call` formatting from the old string
  // while `view.messages` shows the new one
  const own: View.Messages = Object.freeze({ ...messages });

  const formats = new Map<string, ReturnType<typeof compile>>();

  const say = (() => {
    throw new Error("'say' is a macro and must be used with the relevant saykit plugin");
  }) as unknown as View<Locale>;

  function call(descriptor: View.Descriptor) {
    // An inline message is its own cache key: two lone dates with the same
    // style share one format
    const { id, message = own[id] } = descriptor as { id: string; message?: string };
    if (typeof message !== 'string') throw new Error(`Message for ${id} is not a string`);

    let format = formats.get(message);
    if (!format) formats.set(message, (format = compile(locale, message)));

    return String(format.format(resolveDescriptorValues(descriptor)));
  }

  return Object.freeze(
    Object.defineProperties(say, {
      locale: { value: locale, enumerable: true },
      messages: { value: own, enumerable: true },
      // Own, so it shadows `Function.prototype.call`: the transform compiles
      // every message down to `say.call({ id, ... })`
      call: { value: call },
      plural: { value: () => macro('plural') },
      ordinal: { value: () => macro('ordinal') },
      select: { value: () => macro('select') },
      number: { value: () => macro('number') },
      date: { value: () => macro('date') },
      time: { value: () => macro('time') },
      [Symbol.for('nodejs.util.inspect.custom')]: {
        value: (
          _depth: number,
          context: import('node:util').InspectContext,
          inspect: typeof import('node:util').inspect,
        ) => `View<${inspect(locale, context)}> {}`,
      },
    }),
  );
}
