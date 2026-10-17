import { compileMessage, type Message } from './message.js';
import type {
  DateTimeOptions,
  Disallow,
  Named,
  NumberOptions,
  NumeralOptions,
  SelectOptions,
} from './types.js';

function macro(name: string): never {
  throw new Error(`'say.${name}' is a macro and must be used with the relevant saykit plugin`);
}

export namespace View {
  /**
   * One locale's messages, compiled.
   *
   * Each is a {@link Message} the CLI compiled from the catalogue, with every
   * style already resolved. Being data rather than code, a locale's messages
   * serialise, which is what lets a server hand them to a client tree.
   */
  export type Messages = { [key: string]: Message };

  /**
   * What the transform compiles a message down to: the id it was extracted
   * under, or the compiled message itself when there was nothing to extract,
   * with its values behind one underscore each.
   */
  export type Descriptor = ({ id: string } | { message: Message }) & {
    [match: string | number]: unknown;
  };

  export interface Options {
    /**
     * Whether a substituted value is wrapped in Unicode bidi isolation marks,
     * U+2068 and U+2069, so right-to-left text cannot reorder the sentence
     * around it.
     *
     * `'none'` leaves values byte-for-byte as given, for output that is parsed
     * after it is formatted: a Discord mention such as `<#123>` stops being
     * one once the id inside it is isolated.
     *
     * @default 'default'
     */
    bidiIsolation?: 'default' | 'none';
  }
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
   * How this view formats its messages. Plain data, so it can cross a
   * server/client boundary alongside {@link locale} and {@link messages}.
   */
  readonly options: Readonly<View.Options>;

  /**
   * Format the message a descriptor names, or the message it carries.
   *
   * A message with nothing to translate, a lone `say.date(x)` with no text
   * around it, is never extracted: the transform writes the compiled message
   * into the call instead of an id.
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
 * A frozen deep copy of some messages.
 *
 * Messages are only strings, arrays and plain objects, so this is all a copy
 * has to handle. `Object.fromEntries` defines own properties, so a key named
 * `__proto__` stays one.
 */
function snapshot(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(snapshot));
  return Object.freeze(
    Object.fromEntries(Object.entries(value).map(([key, node]) => [key, snapshot(node)])),
  );
}

/**
 * Create a view over one locale and the messages it formats against.
 *
 * A catalogue memoises one per locale, which is how application code usually
 * reaches one; a single-locale app can build one directly.
 *
 * @param locale The locale to bind to
 * @param messages The messages this view formats against
 * @param options How this view formats its messages
 * @returns The view
 */
export function createView<Locale extends string>(
  locale: Locale,
  messages: View.Messages,
  options: View.Options = {},
): View<Locale> {
  const { bidiIsolation } = options;
  // Only what was set, so a view built with no options reports none
  const ownOptions: View.Options = Object.freeze(bidiIsolation ? { bidiIsolation } : {});

  // Copied and frozen all the way down, so nothing can change a message out
  // from under the view: an edit to the source after this would otherwise
  // reach a message not yet called and miss one already compiled
  const own = snapshot(messages) as View.Messages;

  const say = (() => {
    throw new Error("'say' is a macro and must be used with the relevant saykit plugin");
  }) as unknown as View<Locale>;

  // One compile per message, on the first call that needs it. A message nobody
  // renders is never walked, and one rendered a thousand times is walked once
  const compiled = new Map<string, (values: Message.Values) => string>();

  function call(descriptor: View.Descriptor) {
    // An inline message is one helper over one value, and the transform writes
    // a fresh literal into every call, so it is walked rather than cached
    // The index signature keeps `in` from narrowing, so the shape is asserted
    const { id, message } = descriptor as { id: string; message?: Message };
    if (message !== undefined) return compileMessage(message, locale, ownOptions)(descriptor);

    let format = compiled.get(id);

    if (!format) {
      // Own keys only, so an id like `constructor` is not found on the prototype
      const message = Object.hasOwn(own, id) ? own[id] : undefined;
      if (message === undefined) throw new Error(`No message for ${id} in locale '${locale}'`);

      compiled.set(id, (format = compileMessage(message, locale, ownOptions)));
    }

    return format(descriptor);
  }

  return Object.freeze(
    Object.defineProperties(say, {
      locale: { value: locale, enumerable: true },
      messages: { value: own, enumerable: true },
      options: { value: ownOptions, enumerable: true },
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
