import { describe, expect, it } from 'vitest';
import { generateHash } from './hash.js';

describe('generateHash', () => {
  it('should generate a hash from an input', () => {
    const hash = generateHash('my message');
    expect(hash).toMatchInlineSnapshot('"vQhkQx"');
  });

  it('should generate a hash from an input and context', () => {
    const hash = generateHash('my message', 'some context');
    expect(hash).toMatchInlineSnapshot('"NHsKx2"');
  });

  it('should generate different hashes for different contexts', () => {
    const withoutContext = generateHash('my message');
    const withContext = generateHash('my message', 'some context');

    expect(withContext === withoutContext).toBeFalsy();
  });

  it('should generate the same hash if context is falsy', () => {
    const withoutContext = generateHash('my message');
    const withUndefinedContext = generateHash('my message', undefined);
    const withEmptyStringContext = generateHash('my message', '');

    expect(withUndefinedContext === withoutContext).toBeTruthy();
    expect(withEmptyStringContext === withoutContext).toBeTruthy();
  });
});
