import { describe, expect, it } from 'vitest';
import { escapeIcuLiteral } from './escape.js';

describe('escapeIcuLiteral', () => {
  it('leaves ordinary text alone', () => {
    expect(escapeIcuLiteral('Hello, world')).toBe('Hello, world');
  });

  it('quotes a brace so it reads as a brace', () => {
    expect(escapeIcuLiteral('use {} for an object')).toBe("use '{}' for an object");
    expect(escapeIcuLiteral('open { close }')).toBe("open '{' close '}'");
  });

  it('doubles an apostrophe', () => {
    expect(escapeIcuLiteral("it's")).toBe("it''s");
  });

  // The doubling runs first, so the apostrophes the quoting adds stay quoting
  // and the author's own stay text
  it('keeps an apostrophe next to a brace apart from the quoting', () => {
    expect(escapeIcuLiteral("it's {")).toBe("it''s '{'");
  });

  it('leaves a hash alone outside a plural', () => {
    // A lone apostrophe before an ordinary character is literal in MF1, so
    // quoting `#` where it means nothing would print the quotes
    expect(escapeIcuLiteral('issue #12')).toBe('issue #12');
  });

  it('quotes a hash inside a plural', () => {
    expect(escapeIcuLiteral('issue #12', true)).toBe("issue '#'12");
  });

  it('returns empty text unchanged', () => {
    expect(escapeIcuLiteral('')).toBe('');
  });
});
