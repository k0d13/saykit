import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCatalogue } from 'saykit';
import { describe, expect, it, vi } from 'vitest';

// React's `cache` only memoises inside a Server Component render. Under test we
// replace it with a plain single-value memoiser, so the request cell is shared
// across a scope and the reads below it the way it is at runtime
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
      let has = false;
      let value: R;
      return (...args: A) => {
        if (!has) {
          value = fn(...args);
          has = true;
        }
        return value;
      };
    },
  };
});

const { createWithSay, getSay, setSay } = await import('~/runtime/server.js');
const { SayProvider } = await import('~/runtime/client.server.js');

const make = () =>
  createCatalogue({
    en: { greeting: 'Hi' },
    fr: () => Promise.resolve({ default: { greeting: 'Salut' } }),
  });

// Kept for the whole file: the views below share one request cell, so the
// warning a second locale produces belongs to the file rather than to a test.
// Collected here rather than read off the spy, whose calls are cleared per test
const warnings: unknown[] = [];
vi.spyOn(console, 'warn').mockImplementation((message) => void warnings.push(message));

describe('server runtime', () => {
  // Runs first, before anything established a view, so the request cell is
  // still empty
  it('throws before a view has been established', () => {
    expect(() => getSay()).toThrow("'getSay' must be called below a 'withSay'");
  });

  it('withSay negotiates the locale, loads it, and renders the component', async () => {
    const Component = vi.fn((props: { params: Promise<{ locale: string }> }) => {
      void props;
      return createElement('span', null, getSay().messages.greeting);
    });
    const Wrapped = createWithSay(make())(Component, (props) =>
      props.params.then((params) => params.locale),
    );

    const params = Promise.resolve({ locale: 'fr-CA' });
    const element = (await Wrapped({ params })) as ReactElement;

    expect(element.type).toBe(Component);
    expect(element.props).toEqual({ params });
    expect(getSay().locale).toBe('fr');
    expect(renderToStaticMarkup(element)).toBe('<span>Salut</span>');
  });

  it('setSay takes a view as it is, instead of a catalogue and a locale', async () => {
    const view = await make().load('fr');
    setSay(view);

    expect(getSay() === (view as unknown)).toBe(true);
  });

  it('the server build of SayProvider fills its props from the established view', async () => {
    setSay(await make().load('en'));

    const html = renderToStaticMarkup(
      createElement(SayProvider, null, createElement('span', null, 'child')),
    );
    expect(html).toBe('<span>child</span>');

    const element = SayProvider({ children: null });
    const props = element.props as { locale: string; messages: { greeting: string } };
    expect(props.locale).toBe('en');
    expect(props.messages.greeting).toBe('Hi');
  });

  it('the server build of SayProvider passes the view options to the client', () => {
    setSay(createCatalogue({ en: { greeting: 'Hi' } }, { bidiIsolation: 'none' }).locale('en'));

    const element = SayProvider({ children: null });
    expect((element.props as { options: unknown }).options).toEqual({ bidiIsolation: 'none' });
  });

  // The cell above is one request for the whole file, and the views already
  // established have changed its locale, so this counts the warnings the file
  // produced rather than establishing more of its own
  it('warns once when a second view changes the locale in one request', async () => {
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("A view for 'en' was established");

    // The same locale again is not a change, and a change has already been
    // reported
    setSay(await make().load('en'));
    setSay(await make().load('fr'));
    expect(warnings).toHaveLength(1);
    expect(getSay().locale).toBe('fr');
  });
});
