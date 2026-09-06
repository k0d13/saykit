import { inspect } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { createCatalogue, createStore, type View } from './index.js';

type Locale = 'en' | 'fr' | 'de';

const messages = {
  en: {
    greeting: 'Hello',
    items: ['?', ['=', ['v', '_count'], 1], '1 item', ['c', ['v', '_count'], ' items']],
    named: ['c', 'Hello, ', ['v', '_name']],
    identified: ['c', 'Order ', ['v', '_id']],
    underscored: ['c', 'Total ', ['v', '__total']],
  },
  fr: {
    greeting: 'Bonjour',
    items: ['?', ['=', ['v', '_count'], 1], '1 article', ['c', ['v', '_count'], ' articles']],
  },
} satisfies Partial<Record<Locale, View.Messages>>;

/**
 * A catalogue over all three locales, with 'de' behind a thunk nobody has
 * loaded, so tests have both a filled locale and an empty one.
 */
function make() {
  return createCatalogue({ ...messages, de: () => ({ greeting: 'Hallo' }) });
}

describe('createStore', () => {
  it('starts on the locale it is given', () => {
    const store = createStore(make(), 'fr');
    expect(store.say.locale).toBe('fr');
    expect(store.say.call({ id: 'greeting' })).toBe('Bonjour');
  });

  it("starts on the catalogue's default locale", () => {
    expect(createStore(make()).say.locale).toBe('en');
  });

  it('throws when the starting locale has no messages', () => {
    expect(() => createStore(make(), 'de')).toThrow(
      "Messages for locale 'de' have not been loaded yet",
    );
  });

  it('hands back the view the catalogue memoised', () => {
    const catalogue = make();
    expect(createStore(catalogue, 'en').say).toBe(catalogue.locale('en'));
  });

  it('is frozen', () => {
    expect(Object.isFrozen(createStore(make()))).toBe(true);
  });

  it('reads `say` afresh, so a switch is not lost to a binding held over it', () => {
    const store = createStore(make(), 'en');
    const before = store.say;

    store.set('fr');
    expect(store.say).not.toBe(before);
    expect(before.call({ id: 'greeting' })).toBe('Hello');
    expect(store.say.call({ id: 'greeting' })).toBe('Bonjour');
  });

  it('names the current locale when inspected', () => {
    expect(inspect(createStore(make(), 'fr'))).toBe("Store<'fr'> {}");
  });
});

describe('Store#set', () => {
  it('swaps the current view synchronously when the locale is loaded', () => {
    const store = createStore(make(), 'en');
    expect(store.set('fr')).toBeUndefined();
    expect(store.say.locale).toBe('fr');
    expect(store.say.call({ id: 'greeting' })).toBe('Bonjour');
  });

  it('loads a locale the catalogue does not have yet', async () => {
    const thunk = vi.fn(async () => ({ greeting: 'Hallo' }));
    const catalogue = createCatalogue({ en: messages.en, de: thunk });
    const store = createStore(catalogue, 'en');

    const result = store.set('de');
    expect(result).toBeInstanceOf(Promise);
    // The swap waits for the load, so the old view is still current until then
    expect(store.say.locale).toBe('en');

    await result;
    expect(store.say.locale).toBe('de');
    expect(thunk).toHaveBeenCalledOnce();
  });

  it('stays synchronous when the thunk is', () => {
    const catalogue = createCatalogue({ en: messages.en, de: () => ({ greeting: 'Hallo' }) });
    const store = createStore(catalogue, 'en');

    expect(store.set('de')).toBeUndefined();
    expect(store.say.locale).toBe('de');
  });

  it('does nothing when the locale is already current', () => {
    const store = createStore(make(), 'en');
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.set('en')).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the current view when the load fails', async () => {
    const catalogue = createCatalogue({
      en: messages.en,
      de: async () => {
        throw new Error('offline');
      },
    });
    const store = createStore(catalogue, 'en');
    const listener = vi.fn();
    store.subscribe(listener);

    await expect(store.set('de')).rejects.toThrow('offline');
    expect(store.say.locale).toBe('en');
    expect(listener).not.toHaveBeenCalled();
  });

  it('lets a locale whose load failed be asked for again', async () => {
    let attempt = 0;
    const catalogue = createCatalogue({
      en: messages.en,
      de: async () => {
        if (++attempt === 1) throw new Error('offline');
        return { greeting: 'Hallo' };
      },
    });
    const store = createStore(catalogue, 'en');

    await expect(store.set('de')).rejects.toThrow('offline');
    await store.set('de');
    expect(store.say.locale).toBe('de');
  });

  it('rethrows when the catalogue has no such locale', () => {
    const store = createStore(createCatalogue(messages), 'en');

    expect(() => store.set('zz' as 'en' | 'fr')).toThrow("No messages for locale 'zz'");
    expect(store.say.locale).toBe('en');
  });

  it('applies the last switch, not the last to resolve', async () => {
    const resolvers = new Map<string, (loaded: View.Messages) => void>();
    const catalogue = createCatalogue({
      en: messages.en,
      fr: () =>
        new Promise<View.Messages>((resolve) => {
          resolvers.set('fr', resolve);
        }),
      de: () =>
        new Promise<View.Messages>((resolve) => {
          resolvers.set('de', resolve);
        }),
    });
    const store = createStore(catalogue, 'en');

    const first = store.set('fr');
    const second = store.set('de');

    // The later switch lands first; the earlier one is stale by the time its
    // own load resolves, and must not overwrite it
    resolvers.get('de')?.({ greeting: 'Hallo' });
    await second;
    expect(store.say.locale).toBe('de');

    resolvers.get('fr')?.({ greeting: 'Bonjour' });
    await first;
    expect(store.say.locale).toBe('de');
  });

  it('cancels a switch that is overtaken by a switch back', async () => {
    let resolve!: (loaded: View.Messages) => void;
    const catalogue = createCatalogue({
      en: messages.en,
      de: () =>
        new Promise<View.Messages>((r) => {
          resolve = r;
        }),
    });
    const store = createStore(catalogue, 'en');
    const listener = vi.fn();
    store.subscribe(listener);

    const switching = store.set('de');
    // Asked for while the load is still in flight: the store is on 'en' and
    // staying there, so the pending switch has been called off
    expect(store.set('en')).toBeUndefined();

    resolve({ greeting: 'Hallo' });
    await switching;
    expect(store.say.locale).toBe('en');
    // The switch back landed on the view that was already current, so there
    // was never a change to report
    expect(listener).not.toHaveBeenCalled();
  });

  it('hands a second caller the switch already in flight', async () => {
    const thunk = vi.fn(
      async () => new Promise<View.Messages>((r) => setTimeout(() => r({ greeting: 'Hallo' }), 0)),
    );
    const catalogue = createCatalogue({ en: messages.en, de: thunk });
    const store = createStore(catalogue, 'en');

    const first = store.set('de');
    // Same locale, still loading: the same switch comes back rather than
    // `undefined`, so awaiting it waits for the switch instead of resuming
    // while the store is still on 'en'
    const second = store.set('de');
    expect(second).toBe(first);

    await second;
    expect(store.say.locale).toBe('de');
    expect(thunk).toHaveBeenCalledOnce();
  });
});

describe('Store#subscribe', () => {
  it('notifies with the view that is now current', () => {
    const store = createStore(make(), 'en');
    const listener = vi.fn();
    store.subscribe(listener);

    store.set('fr');
    expect(listener).toHaveBeenCalledExactlyOnceWith(store.say);
    expect(store.say.locale).toBe('fr');
  });

  it('does not notify on subscribe', () => {
    const listener = vi.fn();
    createStore(make(), 'en').subscribe(listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every listener', () => {
    const store = createStore(make(), 'en');
    const listeners = [vi.fn(), vi.fn()];
    for (const listener of listeners) store.subscribe(listener);

    store.set('fr');
    for (const listener of listeners) expect(listener).toHaveBeenCalledOnce();
  });

  it('stops notifying once unsubscribed', () => {
    const store = createStore(make(), 'en');
    const listener = vi.fn();
    store.subscribe(listener)();

    store.set('fr');
    expect(listener).not.toHaveBeenCalled();
  });

  it('gives a new view identity per locale, and the same one on the way back', () => {
    // What a `useSyncExternalStore` snapshot compares: the identity changes
    // with the locale, and a catalogue memoises, so returning to a locale
    // returns to its view
    const store = createStore(make(), 'en');
    const en = store.say;

    store.set('fr');
    expect(store.say).not.toBe(en);
    store.set('en');
    expect(store.say).toBe(en);
  });
});
