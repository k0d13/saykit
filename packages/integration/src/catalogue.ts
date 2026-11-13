import { createView, type View } from './view.js';

export namespace Catalogue {
  /**
   * One guess at a locale, or several. Guesses are read from cookies, headers
   * and URL segments, none of which is guaranteed to be there, so an absent
   * one is allowed and skipped.
   */
  export type Guess = string | null | undefined | readonly (string | null | undefined)[];

  /**
   * Where one locale's messages come from: the messages themselves, or a
   * function that produces them the first time the locale is asked for.
   *
   * A thunk is normally a dynamic import, which is what splits a locale into
   * its own chunk: `fr: () => import('./locales/fr.po')`. Written per locale
   * rather than as one function keyed by locale, so a bundler can see each
   * import statically.
   */
  export type Source = View.Messages | (() => Catalogue.Produced | Promise<Catalogue.Produced>);

  /**
   * What a thunk produces: a locale's messages, or the module a dynamic import
   * resolves to, which holds them as its default export.
   */
  export type Produced = View.Messages | { default: View.Messages };

  /** How every view the catalogue hands back formats its messages. */
  export type Options = View.Options;
}

/**
 * Everything an application knows how to say: its locales and where their
 * messages come from.
 *
 * A catalogue never formats anything and has no active locale. Formatting is
 * what a {@link View} does, and a view is what `locale` hands back.
 */
export interface Catalogue<Locale extends string = string> {
  /**
   * All available locales, in the order they were written.
   *
   * Never empty, and the first of them is the fallback: the locale
   * {@link match} resolves to when nothing else does.
   */
  readonly locales: readonly [Locale, ...Locale[]];

  /**
   * A view bound to one locale: callable, immutable, and memoised, so asking
   * twice returns the same view.
   *
   * @param locale Locale to bind to
   * @returns The view for the locale
   * @throws If the locale's messages are not here yet, as for a thunk nobody
   *   has {@link load}ed
   */
  locale(locale: Locale): View<Locale>;

  /**
   * Whether a locale's messages are here, and so whether
   * {@link Catalogue.locale} hands back a view for it. Inline messages are
   * here from the start; a thunk's once it has been {@link load}ed.
   *
   * @param locale Locale to check
   */
  loaded(locale: Locale): boolean;

  /**
   * Calls a locale's thunk, if it has one and nothing has called it yet, and
   * hands back the locale's view.
   *
   * If the thunk returns a promise, so does this. A locale whose messages are
   * already here does not go near its thunk and comes back synchronously,
   * which keeps a switch between loaded locales in one tick.
   *
   * A thunk is called once and a locale is filled once, so nothing can replace
   * the messages a view was built over.
   *
   * @param locale Locale to load
   * @returns The view for the locale
   */
  load(locale: Locale): View<Locale> | Promise<View<Locale>>;

  /**
   * Matches the best locale from a list of guesses.
   *
   * Guesses are tried in order, and an earlier guess that matches at all wins
   * over a later one that would match more closely. Each guess is
   * canonicalised first, so case does not matter (`en-us` is `en-US`), and
   * then compared in steps, most specific first:
   *
   * 1. The same tag
   * 2. The same language and script, filling in the script a tag implies, so
   *    `zh-HK` (Traditional) finds `zh-TW` rather than `zh-CN`
   * 3. The same language subtag, whole, so `fi` never matches `fil`
   *
   * Within a step, the locale written first wins, so with `pt-BR` before
   * `pt-PT`, `pt` matches `pt-BR`.
   *
   * An absent or empty guess is skipped rather than throwing, which lets a
   * caller write `match(fromCookie, fromHeader)` without narrowing each first.
   * So is one that is not a well-formed locale tag, unless it is written
   * exactly as one of {@link locales}.
   *
   * @param guesses List of locale guesses
   * @returns The best matching locale, or the first of {@link locales} if no
   *   matches are found
   */
  match(...guesses: Catalogue.Guess[]): Locale;

  /**
   * Every locale, paired with its view.
   *
   * @throws If any locale's messages have not been produced yet
   */
  [Symbol.iterator](): IterableIterator<[Locale, View<Locale>]>;
}

/**
 * Create a {@link Catalogue}.
 *
 * @example
 * ```ts
 * const catalogue = createCatalogue({
 *   en,
 *   fr: () => import('./locales/fr.po'),
 *   pl: () => import('./locales/pl.po'),
 * });
 *
 * const say = catalogue.locale('en');
 * ```
 *
 * @param messages Where each locale's messages come from, keyed by locale. The
 *   keys are the catalogue's locales, in the order they are written, and the
 *   first of them is the default locale
 * @param options How every view the catalogue hands back formats its
 *   messages, such as `{ bidiIsolation: 'none' }`
 * @returns The catalogue
 */
export function createCatalogue<const Locale extends string = string>(
  messages: Record<Locale, Catalogue.Source>,
  options: Catalogue.Options = {},
): Catalogue<Locale> {
  // Copied, so the caller cannot later change how views not yet built format
  const { bidiIsolation } = options;

  // Null prototype, so a locale named after something on `Object.prototype`,
  // such as `constructor`, reads as unconfigured rather than as a source
  const sources = Object.assign(
    Object.create(null) as Record<Locale, Catalogue.Source | undefined>,
    messages,
  );

  // The locales, in the order written, the first being the fallback. Copied
  // out once, so the caller cannot later change which locales this has
  const keys = Object.freeze(Object.keys(sources) as Locale[]);

  // At least one locale, so `match` always has something to fall back to.
  // Checked here rather than in the type, for records built at runtime
  if (keys.length === 0) throw new Error('A catalogue needs at least one locale, none were given');

  const locales = keys as readonly [Locale, ...Locale[]];

  // Parsed once for `match`, leaving out locales that aren't well-formed tags
  const tags = locales.flatMap((locale) => {
    const tag = parseTag(locale);
    return tag ? [[locale, tag] as const] : [];
  });

  const store = new Map<Locale, View.Messages>();
  const views = new Map<Locale, View<Locale>>();

  /**
   * Thunks already called and still running, so two loads of the same locale
   * share one call rather than starting the dynamic import twice.
   */
  const loading = new Map<Locale, Promise<View<Locale>>>();

  /**
   * Fill a locale's messages, once. A view holds the messages it was built
   * over and the formats compiled from them, so a second write would leave
   * every earlier view formatting text nobody can reach.
   */
  function fill(locale: Locale, produced: Catalogue.Produced) {
    // A dynamic import resolves to a module. Messages are strings or arrays, so an object `default`
    // is the module's export
    const { default: inner } = produced;
    const messages =
      typeof inner === 'object' && !Array.isArray(inner) ? (inner as View.Messages) : produced;

    if (!store.has(locale)) store.set(locale, messages as View.Messages);
    return catalogue.locale(locale);
  }

  const catalogue: Catalogue<Locale> = {
    locales,

    locale(locale) {
      const messages = store.get(locale);
      if (!messages)
        throw new Error(
          typeof sources[locale] === 'function'
            ? `Messages for locale '${locale}' have not been loaded yet`
            : `No messages for locale '${locale}'`,
        );

      let view = views.get(locale);
      if (!view) views.set(locale, (view = createView(locale, messages, { bidiIsolation })));
      return view;
    },

    loaded(locale) {
      return store.has(locale);
    },

    load(locale) {
      if (store.has(locale)) return catalogue.locale(locale);

      const pending = loading.get(locale);
      if (pending) return pending;

      const source = sources[locale];
      if (typeof source !== 'function') throw new Error(`No messages for locale '${locale}'`);

      const produced = source();
      if (!(produced instanceof Promise)) return fill(locale, produced);

      const task = produced.then(
        (messages) => {
          loading.delete(locale);
          return fill(locale, messages);
        },
        (error: unknown) => {
          // Dropped rather than kept, so a locale whose import failed can be
          // asked for again
          loading.delete(locale);
          throw error;
        },
      );

      loading.set(locale, task);
      return task;
    },

    match(...guesses) {
      for (const guess of guesses.flat()) {
        if (typeof guess !== 'string' || guess === '') continue;
        const tag = parseTag(guess);
        if (!tag) {
          // Only once parsing fails, so a locale that isn't a well-formed tag
          // still matches, while a well-formed guess keeps to the written order
          if (locales.includes(guess as Locale)) return guess as Locale;
          continue;
        }

        const found =
          tags.find(([, t]) => t.canonical === tag.canonical) ??
          (tag.script
            ? tags.find(([, t]) => t.language === tag.language && t.script === tag.script)
            : undefined) ??
          tags.find(([, t]) => t.language === tag.language);
        if (found) return found[0];
      }

      return locales[0];
    },

    *[Symbol.iterator]() {
      for (const locale of locales) {
        yield [locale, catalogue.locale(locale)] as [Locale, View<Locale>];
      }
    },
  };

  for (const locale of locales) {
    const source = sources[locale]!;
    // A thunk is left alone until the locale is asked for
    if (typeof source !== 'function') fill(locale, source);
  }

  // Frozen for the same reason a view is: nothing should swap a catalogue's
  // methods out from under the code holding it. Lazy locales still fill in
  // over time, in closure state rather than properties of this object
  return Object.freeze(catalogue);
}

/** The parts of a locale tag that {@link Catalogue.match} compares. */
interface Tag {
  /** The tag in canonical form, such as `zh-Hant-HK` for `zh-hant-hk` */
  canonical: string;
  /** The language subtag, lowercase, such as `zh` */
  language: string;
  /**
   * The script, written or implied, such as `Hant` for `zh-HK`. Absent where
   * the runtime has no `Intl.Locale` or no likely script for the language
   */
  script: string | undefined;
}

/**
 * Parse a locale tag, or hand back `undefined` for one that is not
 * well-formed, such as `en_US`.
 */
function parseTag(input: string): Tag | undefined {
  let canonical: string | undefined;
  try {
    [canonical] = Intl.getCanonicalLocales(input);
  } catch {
    return undefined;
  }
  if (!canonical) return undefined;

  // Canonical form lowercases the language subtag, so this compares as is
  const language = canonical.split('-')[0]!;

  // Own try, so a runtime without `Intl.Locale` still matches case-insensitively
  let script: string | undefined;
  try {
    script = new Intl.Locale(canonical).maximize().script;
  } catch {}

  return { canonical, language, script };
}
