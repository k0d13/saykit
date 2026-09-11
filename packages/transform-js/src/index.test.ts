import { describe, expect, it } from 'vitest';
import createJsTransformer from './index.js';

const transformer = createJsTransformer();

describe('createJsTransformer.match', () => {
  it('matches JavaScript and TypeScript extensions', () => {
    for (const ext of ['.js', '.cjs', '.mjs', '.ts', '.mts', '.cts']) {
      expect(transformer.match(`file${ext}`)).toBe(true);
    }
  });

  it('does not match other extensions', () => {
    for (const ext of ['.jsx', '.tsx', '.json', '.css']) {
      expect(transformer.match(`file${ext}`)).toBe(false);
    }
  });
});

describe('createJsTransformer.extract', () => {
  it('extracts a tagged-template message', () => {
    const [message] = transformer.extract('const greeting = say`Hello, ${name}!`;', 'file.ts');
    expect(message).toBeDefined();
    expect(message!.message).toBe('Hello, {name}!');
    expect(message!.id).toBeUndefined();
    expect(message!.references).toEqual(['file.ts:1']);
  });

  // The same value written twice is one value. Numbering it twice asks the
  // caller to supply it under two props and a translator to keep two holes in
  // step, for a sentence that only ever had one thing in it.
  // `#` is how ICU spells the plural's own selector, so interpolating it into a
  // branch is how a case is written, and a `#` an author typed is text
  it('writes a selector interpolated into its own branch as a hash', () => {
    const [message] = transformer.extract(
      'const x = say.plural(count, { one: `${count} item`, other: `${count} items` });',
      'file.ts',
    );
    expect(message!.message).toBe(`{count, plural,
  one {# item}
  other {# items}
}`);
  });

  it('escapes a hash an author wrote in a branch', () => {
    const [message] = transformer.extract(
      "const x = say.plural(count, { other: 'issue #1' });",
      'file.ts',
    );
    expect(message!.message).toContain("other {issue '#'1}");
  });

  it('escapes braces and apostrophes in text', () => {
    const [message] = transformer.extract("const x = say`it's {done}`;", 'file.ts');
    expect(message!.message).toBe("it''s '{'done'}'");
  });

  it('numbers a repeated expression once', () => {
    const [message] = transformer.extract(
      'const x = say`${guesses.length} x ${guesses.length}`;',
      'file.ts',
    );
    expect(message!.message).toBe('{0} x {0}');
  });

  it('numbers expressions that differ apart', () => {
    const [message] = transformer.extract('const x = say`${a.length} x ${b.length}`;', 'file.ts');
    expect(message!.message).toBe('{0} x {1}');
  });

  it('carries through an explicit id and context', () => {
    const [message] = transformer.extract(
      "const g = say({ id: 'greeting', context: 'formal' })`Hi`;",
      'file.ts',
    );
    expect(message!.id).toBe('greeting');
    expect(message!.context).toBe('formal');
  });

  it('extracts choice (plural) calls', () => {
    const [message] = transformer.extract(
      "const c = say.plural(count, { one: '# item', other: '# items' });",
      'file.ts',
    );
    expect(message!.message).toContain('plural');
  });

  it('names a placeholder written as a single-key object', () => {
    const [message] = transformer.extract(
      'const t = say`Total: ${{ cartTotal: getTotal() }}`;',
      'file.ts',
    );
    expect(message!.message).toBe('Total: {cartTotal}');
  });

  it('leaves unnamed placeholders numbered alongside named ones', () => {
    const [message] = transformer.extract('const t = say`${{ total: a.b }} ${c.d}`;', 'file.ts');
    expect(message!.message).toBe('{total} {0}');
  });

  it('throws for a name that is not a valid identifier', () => {
    expect(() => transformer.extract("const t = say`${{ 'cart total': x }}`;", 'file.ts')).toThrow(
      "Invalid placeholder name 'cart total'",
    );
  });

  it('throws for a branch key ICU cannot express', () => {
    expect(() =>
      transformer.extract(
        "const s = say.select(status, { 'sold-out': 'Sold out', other: 'In stock' });",
        'file.ts',
      ),
    ).toThrow("Invalid select branch key 'sold-out', an ICU key cannot contain punctuation");
  });

  it('returns an empty array when there are no messages', () => {
    expect(transformer.extract('const x = 1 + 2;', 'file.ts')).toEqual([]);
  });
});

describe('translator comments', () => {
  const comments = (code: string) => transformer.extract(code, 'file.ts').map((m) => m.comments);

  // A comment on its own line is attached to whichever node starts at it, which
  // is almost never the message itself
  it.each([
    ['an expression statement', '// TRANSLATORS: hi\nsay`Hello`;'],
    ['a declaration', '// TRANSLATORS: hi\nconst a = say`Hello`;'],
    ['an exported declaration', '// TRANSLATORS: hi\nexport const a = say`Hello`;'],
    ['a default export', '// TRANSLATORS: hi\nexport default say`Hello`;'],
    ['a return', 'function f() {\n  // TRANSLATORS: hi\n  return say`Hello`;\n}'],
    ['an object property', 'const o = {\n  // TRANSLATORS: hi\n  a: say`Hello`,\n};'],
    ['an array element', 'const o = [\n  // TRANSLATORS: hi\n  say`Hello`,\n];'],
    ['a call argument', 'f(\n  // TRANSLATORS: hi\n  say`Hello`,\n);'],
    ['a block comment', '/* TRANSLATORS: hi */\nconst a = say`Hello`;'],
    ['the message itself', 'const a = /* TRANSLATORS: hi */ say`Hello`;'],
  ])('reads a comment written above %s', (_, code) => {
    expect(comments(code)).toEqual([['hi']]);
  });

  it('reads a comment written above a selector call', () => {
    expect(comments('// TRANSLATORS: hi\nconst a = say.plural(n, { other: `days` });')).toEqual([
      ['hi'],
    ]);
  });

  it('reads a comment written above an argument call', () => {
    expect(comments('// TRANSLATORS: hi\nconst a = say`${say.number(total)} left`;')).toEqual([
      ['hi'],
    ]);
  });

  it('keeps several comments in the order they were written', () => {
    expect(comments('// TRANSLATORS: one\n// TRANSLATORS: two\nconst a = say`Hello`;')).toEqual([
      ['one', 'two'],
    ]);
  });

  it('matches the marker regardless of case', () => {
    expect(comments('// translators: hi\nconst a = say`Hello`;')).toEqual([['hi']]);
  });

  it('ignores a comment without the marker', () => {
    expect(comments('// a note for whoever reads this\nconst a = say`Hello`;')).toEqual([[]]);
  });

  it('takes only the marked comment out of a run of them', () => {
    expect(comments('// a note\n// TRANSLATORS: hi\nconst a = say`Hello`;')).toEqual([['hi']]);
  });

  // A statement is as wide as attribution goes: a comment above a function
  // describes the function, not every message written inside it
  it('does not reach past the statement holding the message', () => {
    expect(comments('// TRANSLATORS: hi\nfunction f() {\n  return say`Hello`;\n}')).toEqual([[]]);
  });

  it('does not carry a comment on to the next message', () => {
    expect(comments('// TRANSLATORS: hi\nconst a = say`Hello`;\nconst b = say`Bye`;')).toEqual([
      ['hi'],
      [],
    ]);
  });
});

describe('createJsTransformer.transform', () => {
  it('rewrites a tagged template into a `.call`', () => {
    const output = transformer.transform('const greeting = say`Hello, ${name}!`;', 'file.ts');
    expect(output).toContain('say.call(');
    expect(output).toContain('_name: name');
    expect(output).not.toContain('say`');
  });

  it('keeps a value named `id` from displacing the message id', () => {
    const output = transformer.transform('const g = say`Hi ${id}`;', 'file.ts');
    // Both are properties of one object, so without the prefix the value would
    // win and the descriptor would no longer name a message
    expect(output).toMatch(/id: "[^"]+"/);
    expect(output).toContain('_id: id');
  });

  it('compiles a named placeholder without its wrapper', () => {
    const output = transformer.transform(
      'const t = say`Total: ${{ cartTotal: getTotal() }}`;',
      'file.ts',
    );
    expect(output).toContain('_cartTotal: getTotal()');
    // The single-key object that named it is gone, not nested inside the call
    expect(output).not.toContain('{ cartTotal:');
  });

  it('throws for a name that is not a valid identifier', () => {
    expect(() =>
      transformer.transform("const t = say`${{ 'cart total': x }}`;", 'file.ts'),
    ).toThrow("Invalid placeholder name 'cart total'");
  });

  // A lone formatted value has nothing a translator could change, so it is
  // never extracted: the style resolves at build time and the call formats it
  it('compiles a lone argument to its message rather than an id', () => {
    const code = 'const d = say.date(at, { style: "::yMMM" });';
    expect(transformer.extract(code, 'file.ts')).toEqual([]);
    const output = transformer.transform(code, 'file.ts');
    expect(output).toContain('message: "{at, date, ::yMMM}"');
    expect(output).toContain('_at: at');
    expect(output).not.toMatch(/\bid:/);
  });

  it('still extracts an argument written into a sentence', () => {
    expect(transformer.extract('const d = say`Due ${say.date(at)}`;', 'file.ts')).toHaveLength(1);
  });

  it('leaves code without messages untouched', () => {
    const output = transformer.transform('const x = 1 + 2;', 'file.ts');
    expect(output).toContain('1 + 2');
    expect(output).not.toContain('.call(');
  });
});

describe('duplicate placeholder names', () => {
  it('allows the same value interpolated twice', () => {
    const [message] = transformer.extract('const t = say`${name} and ${name}`;', 'file.ts');
    expect(message!.message).toBe('{name} and {name}');
    // One name is one value, so the repeat compiles to a single property
    const output = transformer.transform('const t = say`${name} and ${name}`;', 'file.ts');
    expect(output.match(/_name:/g)).toHaveLength(1);
  });

  it('allows two named placeholders that name the same expression', () => {
    const code = 'const t = say`${{ name: author.name }} and ${{ name: author.name }}`;';
    expect(transformer.extract(code, 'file.ts')[0]!.message).toBe('{name} and {name}');
    expect(transformer.transform(code, 'file.ts').match(/_name:/g)).toHaveLength(1);
  });

  it('rejects one name given to two different expressions', () => {
    expect(() =>
      transformer.extract(
        'const t = say`${{ n: items.length }} ${{ n: users.length }}`;',
        'file.ts',
      ),
    ).toThrow(
      "Duplicate placeholder name 'n', give each value in a message its own name unless they are identical",
    );
  });

  it('rejects a name that collides with a variable interpolated directly', () => {
    expect(() =>
      transformer.transform('const t = say`${name} ${{ name: author.name }}`;', 'file.ts'),
    ).toThrow("Duplicate placeholder name 'name'");
  });

  it('compares a choice selector against the values around it', () => {
    expect(() =>
      transformer.extract(
        "const t = say`${count} ${say.plural({ count: items.length }, { other: '#' })}`;",
        'file.ts',
      ),
    ).toThrow("Duplicate placeholder name 'count'");
  });
});
