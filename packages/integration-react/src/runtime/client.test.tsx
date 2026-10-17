// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCatalogue, createStore, type Store, type View } from 'saykit';
import { describe, expect, it } from 'vitest';
import { SayProvider, useSay } from '#/runtime/client.js';

function Consumer() {
  const say = useSay();
  return createElement('span', null, `${say.locale}:${say.call({ id: 'greeting' })}`);
}

const catalogue = () => createCatalogue({ en: { greeting: 'Hello' }, fr: { greeting: 'Bonjour' } });

describe('SayProvider / useSay', () => {
  it('provides a view bound to a serialised locale', () => {
    const html = renderToStaticMarkup(
      createElement(
        SayProvider,
        { locale: 'fr', messages: { greeting: 'Bonjour' } },
        createElement(Consumer),
      ),
    );
    expect(html).toBe('<span>fr:Bonjour</span>');
  });

  it('builds the view with the serialised options', () => {
    function Mention() {
      return createElement('span', null, useSay().call({ id: 'mention', _channel: '<#1>' }));
    }
    const messages: View.Messages = { mention: ['c', 'See ', ['v', '_channel']] };

    const isolated = renderToStaticMarkup(
      createElement(SayProvider, { locale: 'en', messages }, createElement(Mention)),
    );
    expect(isolated).toBe('<span>See ⁨&lt;#1&gt;⁩</span>');

    const raw = renderToStaticMarkup(
      createElement(
        SayProvider,
        { locale: 'en', messages, options: { bidiIsolation: 'none' } },
        createElement(Mention),
      ),
    );
    expect(raw).toBe('<span>See &lt;#1&gt;</span>');
  });

  it('rebuilds when the serialised locale changes', () => {
    const { rerender } = render(
      <SayProvider locale="fr" messages={{ greeting: 'Bonjour' }}>
        <Consumer />
      </SayProvider>,
    );
    expect(screen.getByText('fr:Bonjour')).toBeDefined();

    rerender(
      <SayProvider locale="de" messages={{ greeting: 'Guten Tag' }}>
        <Consumer />
      </SayProvider>,
    );
    expect(screen.getByText('de:Guten Tag')).toBeDefined();
  });

  it('follows a store across a locale switch', async () => {
    const store = createStore(catalogue(), 'en');

    render(
      <SayProvider store={store}>
        <Consumer />
      </SayProvider>,
    );
    expect(screen.getByText('en:Hello')).toBeDefined();

    await act(async () => {
      await store.set('fr');
    });
    expect(screen.getByText('fr:Bonjour')).toBeDefined();
  });

  it('re-renders only the tree below the provider that switched', async () => {
    const one = createStore(catalogue(), 'en');
    const two = createStore(catalogue(), 'fr');

    render(
      <>
        <SayProvider store={one}>
          <Consumer />
        </SayProvider>
        <SayProvider store={two}>
          <Consumer />
        </SayProvider>
      </>,
    );

    await act(async () => {
      await one.set('fr');
    });
    expect(screen.getAllByText('fr:Bonjour')).toHaveLength(2);
  });

  it('follows a store whose subscribe reads its receiver', async () => {
    // A `Store` is an interface, so an application may hand over a class
    // instance rather than the object saykit builds. `subscribe` is called on
    // the store, so one that reads `this` still works
    class ClassStore {
      #view = catalogue().locale('en');
      #listeners = new Set<(view: View) => void>();

      get say() {
        return this.#view;
      }

      set(locale: 'en' | 'fr') {
        this.#view = catalogue().locale(locale);
        for (const listener of this.#listeners) listener(this.#view);
      }

      subscribe(listener: (view: View) => void) {
        this.#listeners.add(listener);
        return () => void this.#listeners.delete(listener);
      }
    }

    const store = new ClassStore();

    render(
      <SayProvider store={store as unknown as Store}>
        <Consumer />
      </SayProvider>,
    );
    expect(screen.getByText('en:Hello')).toBeDefined();

    await act(async () => {
      store.set('fr');
    });
    expect(screen.getByText('fr:Bonjour')).toBeDefined();
  });

  it('throws when given neither a store nor a locale', () => {
    expect(() =>
      renderToStaticMarkup(createElement(SayProvider, null, createElement(Consumer))),
    ).toThrow("'SayProvider' must be given a store, or a locale and its messages");
  });

  it('throws when used outside a provider', () => {
    expect(() => renderToStaticMarkup(createElement(Consumer))).toThrow(
      "'useSay' must be used within a 'SayProvider'",
    );
  });
});
