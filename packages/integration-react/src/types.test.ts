import { describe, expect, it } from 'vitest';
import { resolveValuePropKeys } from '#/types.js';

describe('resolveValuePropKeys', () => {
  it('strips the leading underscore every value prop carries', () => {
    expect(resolveValuePropKeys({ _0: 'a', _12: 'b', _name: 'c' })).toEqual({
      0: 'a',
      12: 'b',
      name: 'c',
    });
  });

  it('strips exactly one underscore, so a name that starts with one survives', () => {
    expect(resolveValuePropKeys({ __link: 'a' })).toEqual({ _link: 'a' });
  });

  it('leaves keys without an underscore untouched', () => {
    expect(resolveValuePropKeys({ name: 'a', label: 'b' })).toEqual({ name: 'a', label: 'b' });
  });
});
