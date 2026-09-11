import { createElement, isValidElement, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Renderer } from '~/components/renderer.js';
import { Say } from '~/runtime/index.js';

// `GET_SAY` is injected by the saykit plugin at build time. In tests we stand
// in a fake global so the component's happy path can run
declare global {
  // eslint-disable-next-line no-var
  var GET_SAY: (() => { call: (descriptor: Record<string, unknown>) => string }) | undefined;
}

afterEach(() => {
  delete (globalThis as { GET_SAY?: unknown }).GET_SAY;
});

describe('Say', () => {
  it('throws when no id is present (used without the plugin)', () => {
    expect(() => (Say as (p: unknown) => unknown)({ context: 'x' })).toThrow(
      "'Say' is a macro and must be used with the relevant saykit plugin",
    );
  });

  it('renders through the Renderer using the resolved message html', () => {
    const call = vi.fn(() => '<name/> world');
    globalThis.GET_SAY = () => ({ call });

    const bold = createElement('b', null, 'Ada');
    const element = (Say as (p: unknown) => ReactElement)({
      id: 'greet',
      whitespace: false,
      _name: bold,
    });

    expect(element.type).toBe(Renderer);
    const props = element.props as {
      html: string;
      whitespace?: boolean;
      components: (tag?: string) => unknown;
    };
    expect(props.html).toBe('<name/> world');
    expect(props.whitespace).toBe(false);
    // The value props reach `say.call` still prefixed, the runtime does the
    // single strip, with the id merged in and `whitespace` removed. Asserted
    // exactly, so a renderer prop leaking into the descriptor fails here
    // rather than reaching the runtime
    expect(call).toHaveBeenCalledWith({ id: 'greet', _name: bold });

    // A slot that maps to a valid element clones it; other slots pass the tag through
    const resolved = props.components('name') as (p: object) => ReactElement;
    expect(typeof resolved).toBe('function');
    expect(isValidElement(resolved({}))).toBe(true);
    expect(props.components('missing')).toBe('missing');
    // The message id is not a value, so nothing resolves for it as a tag
    expect(props.components('id')).toBe('id');
    // Called with no tag, it returns the (undefined) tag
    expect(props.components()).toBeUndefined();
  });

  it('passes a message through in place of an id', () => {
    const call = vi.fn(() => '1,234');
    globalThis.GET_SAY = () => ({ call });

    const message = '{n, number}';
    const element = (Say as (p: unknown) => ReactElement)({ message, _n: 1234 });

    expect((element.props as { html: string }).html).toBe('1,234');
    expect(call).toHaveBeenCalledWith({ message, _n: 1234 });
  });

  it('lets a value be named after one of Say’s own props', () => {
    const call = vi.fn(() => '<id/> and <whitespace/>');
    globalThis.GET_SAY = () => ({ call });

    const bold = createElement('b', null, 'Ada');
    const element = (Say as (p: unknown) => ReactElement)({
      id: 'greet',
      whitespace: false,
      _id: bold,
      _whitespace: bold,
    });

    const props = element.props as {
      whitespace?: boolean;
      components: (tag?: string) => unknown;
    };
    // The real id still reaches `say.call` and the value named after it does
    // not displace it, since the two live in different namespaces until the
    // runtime strips one underscore. The `whitespace` flag is destructured out
    // for the renderer, while a value of that name rides along untouched
    expect(call).toHaveBeenCalledWith({ id: 'greet', _id: bold, _whitespace: bold });
    expect(props.whitespace).toBe(false);
    expect(typeof props.components('id')).toBe('function');
    expect(typeof props.components('whitespace')).toBe('function');
  });

  it('leaves a tag whose name starts with an underscore intact', () => {
    const call = vi.fn(() => '<_link/>');
    globalThis.GET_SAY = () => ({ call });

    const link = createElement('a', null, 'here');
    const element = (Say as (p: unknown) => ReactElement)({ id: 'greet', __link: link });

    const props = element.props as { components: (tag?: string) => unknown };
    // One strip in the runtime and one in the resolver, each on its own copy:
    // `__link` reaches `say.call` untouched and resolves as `_link` for the tag
    expect(call).toHaveBeenCalledWith({ id: 'greet', __link: link });
    expect(typeof props.components('_link')).toBe('function');
  });

  it('exposes Plural, Ordinal and Select macros that throw', () => {
    expect(() => Say.Plural({ _: 1, other: '#' })).toThrow("'Say.Plural' is a macro");
    expect(() => Say.Ordinal({ _: 1, other: '#' })).toThrow("'Say.Ordinal' is a macro");
    expect(() => Say.Select({ _: 'a', other: 'b' })).toThrow("'Say.Select' is a macro");
  });
});
