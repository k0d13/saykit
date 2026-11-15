import { parse, parseExpression } from '@babel/parser';
import traverse_ from '@babel/traverse';
import * as t from '@babel/types';
import {
  ArgumentMessage,
  assignSequenceIdentifiers,
  AUTO_INCREMENT_IDENTIFIER,
  ChoiceMessage,
  CompositeMessage,
  LiteralMessage,
} from '@saykit/config/messages';
import { describe, expect, it } from 'vitest';
import * as parser from './parser.js';

const traverse = ((traverse_ as any).default || traverse_) as typeof traverse_;

// Parse a snippet of real source into its expression node, the way the
// transformer does (see index.ts). `test.js` becomes the reference filename
function expr<T extends t.Expression = t.Expression>(code: string): T {
  return parseExpression(code, {
    sourceFilename: 'test.js',
    plugins: ['typescript'],
  }) as unknown as T;
}

describe('processExpression', () => {
  it('processes a simple `say` identifier', () => {
    const identifier = expr('say');
    expect(parser.processExpression(identifier)).toEqual([identifier, null, null]);
  });

  it('processes `say` with a descriptor object call', () => {
    const call = expr<t.CallExpression>('say({})');
    expect(parser.processExpression(call)).toEqual([call.callee, call.arguments[0], null]);
  });

  it('processes a member expression with a selector', () => {
    const call = expr<t.MemberExpression>('say.plural');
    expect(parser.processExpression(call)).toEqual([call.object, null, 'plural']);
  });

  it('processes a nested member expression with a descriptor', () => {
    const call = expr<t.MemberExpression>('say({}).select');
    const accessor = call.object as t.CallExpression;
    expect(parser.processExpression(call)).toEqual([
      accessor.callee,
      accessor.arguments[0],
      'select',
    ]);
  });

  it('returns null for non-say expressions', () => {
    expect(parser.processExpression(expr('notSay'))).toBeNull();
  });

  it('resolves a say call with too many arguments as a bare accessor', () => {
    const call = expr<t.CallExpression>("say('too', 'many')");
    expect(parser.processExpression(call)).toEqual([call.callee, null, null]);
  });

  it('resolves a computed member whose property is `say`', () => {
    const computed = expr<t.MemberExpression>('foo[say]');
    expect(parser.processExpression(computed)).toEqual([computed, null, null]);
  });

  it('resolves a say call with no arguments', () => {
    const call = expr<t.CallExpression>('say()');
    expect(parser.processExpression(call)).toEqual([call.callee, null, null]);
  });

  it('returns null for a call whose callee does not resolve', () => {
    expect(parser.processExpression(expr('notSay()'))).toBeNull();
  });
});

describe('parseTaggedTemplateExpression', () => {
  it('parses a simple tagged template', () => {
    const result = parser.parseTaggedTemplateExpression(expr('say`Hello`'));
    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(1);
    expect(result!.children[0]).toEqual({ text: 'Hello' });
  });

  it('parses a tagged template with expressions', () => {
    const result = parser.parseTaggedTemplateExpression(expr('say`Hello ${name}!`'));
    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(3);
    expect(result!.children[0]).toBeInstanceOf(LiteralMessage);
    expect(result!.children[0]).toEqual({ text: 'Hello ' });
    expect(result!.children[1]).toBeInstanceOf(ArgumentMessage);
    expect((result!.children[1] as ArgumentMessage).identifier).toBe('name');
    expect(result!.children[2]).toBeInstanceOf(LiteralMessage);
    expect(result!.children[2]).toEqual({ text: '!' });
  });

  // A formatted argument is a fragment, not a whole message, so the shape that
  // matters most is the nested one
  it('parses a nested formatted argument inside a template', () => {
    const result = parser.parseTaggedTemplateExpression(
      expr('say`You have ${say.number(items.length)} items`'),
    );
    assignSequenceIdentifiers(result!);
    expect(result!.toICUString()).toBe('You have {0, number} items');
  });

  it('parses a nested formatted argument with a name and a style', () => {
    const result = parser.parseTaggedTemplateExpression(
      expr("say`Battery at ${say.number({ level: device.level }, { style: 'percent' })}`"),
    );
    expect(result!.toICUString()).toBe('Battery at {level, number, percent}');
  });

  it('parses a tagged template with a descriptor id', () => {
    const result = parser.parseTaggedTemplateExpression(expr("say({ id: 'greeting' })`Hello`"));
    expect(result).not.toBeNull();
    expect(result!.descriptor).toEqual({ id: 'greeting', context: undefined });
  });

  it('parses a tagged template with a context descriptor', () => {
    const result = parser.parseTaggedTemplateExpression(
      expr("say({ context: 'greeting' })`Hello`"),
    );
    expect(result).not.toBeNull();
    expect(result!.descriptor).toEqual({ id: undefined, context: 'greeting' });
  });

  it('extracts translator comments', () => {
    const tag = expr<t.TaggedTemplateExpression>(
      '// Translators: Use formal greeting\n/* Translators: Consider cultural context */\nsay`Hello`',
    );
    const result = parser.parseTaggedTemplateExpression(tag);
    expect(result).not.toBeNull();
    expect(result!.comments).toEqual(['Use formal greeting', 'Consider cultural context']);
  });

  it('includes location information', () => {
    const result = parser.parseTaggedTemplateExpression(expr('say`Hello`'));
    expect(result).not.toBeNull();
    expect(result!.references).toEqual(['test.js:1']);
  });

  it('omits references when the node has no location', () => {
    const tag = expr<t.TaggedTemplateExpression>('say`Hello`');
    tag.loc = null;
    expect(parser.parseTaggedTemplateExpression(tag)!.references).toEqual([]);
  });

  it('returns null for non-say tagged templates', () => {
    expect(parser.parseTaggedTemplateExpression(expr('notSay`Hello`'))).toBeNull();
  });

  it('falls back to the raw quasi value when cooked is undefined', () => {
    // An invalid escape leaves `cooked` null, so the raw text is used instead
    const result = parser.parseTaggedTemplateExpression(expr('say`\\unicode`'));
    expect(result!.children[0]).toEqual({ text: '\\unicode' });
  });

  it('ignores non-translator leading comments', () => {
    const result = parser.parseTaggedTemplateExpression(expr('// just a note\nsay`Hi`'));
    expect(result!.comments).toEqual([]);
  });
});

describe('parseCallExpression', () => {
  // Every choice kind parses through one code path, so they are asserted as a
  // table: the kind, the selector, and the branch list read off it
  it.each([
    [
      "say.plural(count, { one: 'item', other: 'items' })",
      'plural',
      'count',
      [
        ['one', 'item'],
        ['other', 'items'],
      ],
    ],
    [
      "say.ordinal(position, { 1: 'first', 2: 'second', other: 'other' })",
      'ordinal',
      'position',
      [
        ['1', 'first'],
        ['2', 'second'],
        ['other', 'other'],
      ],
    ],
    [
      "say.select(gender, { male: 'He', female: 'She', other: 'They' })",
      'select',
      'gender',
      [
        ['male', 'He'],
        ['female', 'She'],
        ['other', 'They'],
      ],
    ],
    [
      // Numeric keys stay exact matches rather than becoming plural categories
      "say.plural(count, { 0: 'none', 1: 'one', other: 'many' })",
      'plural',
      'count',
      [
        ['0', 'none'],
        ['1', 'one'],
        ['other', 'many'],
      ],
    ],
  ])('parses %s', (code, kind, identifier, branches) => {
    const result = parser.parseCallExpression(expr(code));
    expect(result!.children).toHaveLength(1);
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice).toBeInstanceOf(ChoiceMessage);
    expect(choice.kind).toBe(kind);
    expect(choice.identifier).toBe(identifier);
    expect(choice.branches.map((b) => [b.identifier, (b.value as LiteralMessage).text])).toEqual(
      branches,
    );
  });

  it('reads string-literal (quoted) choice keys', () => {
    const result = parser.parseCallExpression(
      expr("say.plural(count, { 'one': 'item', 'other': 'items' })"),
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.branches[0]!.identifier).toBe('one');
    expect(choice.branches[1]!.identifier).toBe('other');
  });

  it('omits references when the node has no location', () => {
    const call = expr<t.CallExpression>("say.plural(count, { other: 'x' })");
    call.loc = null;
    expect(parser.parseCallExpression(call)!.references).toEqual([]);
  });

  it('extracts translator comments', () => {
    const result = parser.parseCallExpression(
      expr<t.CallExpression>('// Translators: Round the total\nsay.number(total)'),
    );
    expect(result!.comments).toEqual(['Round the total']);
  });

  it('ignores non-translator leading comments', () => {
    const result = parser.parseCallExpression(expr('// just a note\nsay.number(total)'));
    expect(result!.comments).toEqual([]);
  });

  it('parses a select call expression', () => {
    const result = parser.parseCallExpression(
      expr("say.select(gender, { male: 'He', female: 'She', other: 'They' })"),
    );
    expect(result).not.toBeNull();
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice).toBeInstanceOf(ChoiceMessage);
    expect(choice.kind).toBe('select');
    expect(choice.identifier).toBe('gender');
    expect(choice.branches).toHaveLength(3);
    expect(choice.branches[0]!.identifier).toBe('male');
    expect(choice.branches[0]!.value).toEqual({ text: 'He' });
    expect(choice.branches[1]!.identifier).toBe('female');
    expect(choice.branches[1]!.value).toEqual({ text: 'She' });
    expect(choice.branches[2]!.identifier).toBe('other');
    expect(choice.branches[2]!.value).toEqual({ text: 'They' });
  });

  it('parses choices with nested expressions', () => {
    const result = parser.parseCallExpression(expr('say.plural(count, { one: name })'));
    expect(result).not.toBeNull();
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice).toBeInstanceOf(ChoiceMessage);
    expect(choice.kind).toBe('plural');
    expect(choice.identifier).toBe('count');
    expect(choice.branches).toHaveLength(1);
    expect(choice.branches[0]!.identifier).toBe('one');
    expect(choice.branches[0]!.value).toBeInstanceOf(ArgumentMessage);
    expect((choice.branches[0]!.value as ArgumentMessage).identifier).toBe('name');
  });

  it('parses choices with a descriptor', () => {
    const result = parser.parseCallExpression(
      expr("say({ id: 'itemCount' }).plural(count, { one: 'item', other: 'items' })"),
    );
    expect(result).not.toBeNull();
    expect(result!.descriptor).toEqual({ id: 'itemCount', context: undefined });
  });

  it('returns null for non-choice call expressions', () => {
    expect(parser.parseCallExpression(expr('say.something()'))).toBeNull();
  });

  it('parses a plural offset', () => {
    const result = parser.parseCallExpression(
      expr("say.plural(count, { offset: 1, one: 'you and # other', other: 'you and # others' })"),
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.offset).toBe(1);
    expect(choice.branches.map((b) => b.identifier)).toEqual(['one', 'other']);
  });

  it('parses an ordinal offset', () => {
    const result = parser.parseCallExpression(
      expr("say.ordinal(place, { offset: 1, other: '#th' })"),
    );
    expect((result!.children[0] as ChoiceMessage).offset).toBe(1);
  });

  it('leaves the offset undefined when absent', () => {
    const result = parser.parseCallExpression(expr("say.plural(count, { other: '#' })"));
    expect((result!.children[0] as ChoiceMessage).offset).toBeUndefined();
  });

  // `select` has no number to offset, so `offset` there is an ordinary key that
  // happens to be spelled that way
  it('treats offset as a branch key on select', () => {
    const result = parser.parseCallExpression(
      expr("say.select(kind, { offset: 'Offset', other: 'Other' })"),
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.offset).toBeUndefined();
    expect(choice.branches.map((b) => b.identifier)).toEqual(['offset', 'other']);
  });

  // The offset is baked into the extracted message, so it has to be known at
  // build time. Anything else stays a branch and fails branch validation
  it.each(['offset: n', 'offset: 1.5', 'offset: -1'])('ignores a non-literal %s', (offset) => {
    expect(() =>
      parser.parseCallExpression(expr(`say.plural(count, { ${offset}, other: '#' })`)),
    ).not.toThrow();
    const result = parser.parseCallExpression(expr(`say.plural(count, { ${offset}, other: '#' })`));
    expect((result!.children[0] as ChoiceMessage).offset).toBeUndefined();
  });

  it('parses a number call expression', () => {
    const result = parser.parseCallExpression(expr('say.number(total)'));
    expect(result).toBeInstanceOf(CompositeMessage);
    const argument = result!.children[0] as ArgumentMessage;
    expect(argument).toBeInstanceOf(ArgumentMessage);
    expect(argument.identifier).toBe('total');
    expect(argument.format).toEqual({ type: 'number', style: undefined });
  });

  it('parses a number call expression with a style', () => {
    const result = parser.parseCallExpression(expr("say.number(level, { style: 'percent' })"));
    const argument = result!.children[0] as ArgumentMessage;
    expect(argument.format).toEqual({ type: 'number', style: 'percent' });
  });

  it.each(['date', 'time'] as const)('parses a %s call expression with a style', (kind) => {
    const result = parser.parseCallExpression(expr(`say.${kind}(when, { style: 'medium' })`));
    const argument = result!.children[0] as ArgumentMessage;
    expect(argument.format).toEqual({ type: kind, style: 'medium' });
  });

  it('names a number placeholder written as a single-key object', () => {
    const result = parser.parseCallExpression(expr('say.number({ cartTotal: getTotal() })'));
    const argument = result!.children[0] as ArgumentMessage;
    expect(argument.identifier).toBe('cartTotal');
    // The wrapper is gone: what compiles is the value alone
    expect(t.isCallExpression(argument.expression)).toBe(true);
    expect((argument.expression as t.CallExpression).callee).toMatchObject({ name: 'getTotal' });
  });

  it('numbers an unnamed number placeholder', () => {
    const result = parser.parseCallExpression(expr('say.number(items.length)'));
    expect((result!.children[0] as ArgumentMessage).identifier).toBe(AUTO_INCREMENT_IDENTIFIER);
  });

  it('parses a formatted argument with a descriptor', () => {
    const result = parser.parseCallExpression(expr("say({ id: 'total' }).number(sum)"));
    expect(result!.descriptor).toEqual({ id: 'total', context: undefined });
  });

  it('rejects a style the formatter cannot honour', () => {
    expect(() => parser.parseCallExpression(expr("say.date(when, { style: 'meduim' })"))).toThrow(
      "Invalid date style 'meduim'",
    );
  });

  it.each([
    ['date', '::yyyyMMdd'],
    ['number', '::currency/EUR'],
  ] as const)('parses a %s call expression with the skeleton %s', (kind, style) => {
    const result = parser.parseCallExpression(expr(`say.${kind}(v, { style: '${style}' })`));
    const argument = result!.children[0] as ArgumentMessage;
    expect(argument.format).toEqual({ type: kind, style });
  });

  it('rejects a skeleton the formatter cannot resolve', () => {
    expect(() => parser.parseCallExpression(expr("say.date(when, { style: '::qqqq' })"))).toThrow(
      "Invalid date skeleton '::qqqq'",
    );
  });

  // The style is baked into the extracted message, so a value only known at
  // runtime cannot name one. It is dropped rather than guessed at
  it('ignores a style that is not a string literal', () => {
    const result = parser.parseCallExpression(expr('say.number(n, { style: dynamic })'));
    expect((result!.children[0] as ArgumentMessage).format).toEqual({
      type: 'number',
      style: undefined,
    });
  });

  it('returns null for malformed formatted arguments', () => {
    expect(parser.parseCallExpression(expr('say.number()'))).toBeNull();
    expect(parser.parseCallExpression(expr("say.number(n, 'percent')"))).toBeNull();
    expect(parser.parseCallExpression(expr('say.number(n, {}, {})'))).toBeNull();
  });

  it('returns null for malformed choice expressions', () => {
    expect(parser.parseCallExpression(expr('say.plural()'))).toBeNull();
  });

  it('handles bigint identifiers as exact matches', () => {
    const result = parser.parseCallExpression(
      expr("say.plural(count, { 1n: 'one', other: 'many' })"),
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.branches[0]!.identifier).toBe('1');
  });

  it('falls back to the auto-increment identifier for computed keys', () => {
    const result = parser.parseCallExpression(
      expr("say.plural(count, { [a.b]: 'x', other: 'many' })"),
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.branches[0]!.identifier).toBe(AUTO_INCREMENT_IDENTIFIER);
  });

  it('handles numeric identifiers as exact matches', () => {
    const result = parser.parseCallExpression(
      expr("say.plural(count, { 0: 'none', 1: 'one', other: 'many' })"),
    );
    expect(result).not.toBeNull();
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice).toBeInstanceOf(ChoiceMessage);
    expect(choice.kind).toBe('plural');
    expect(choice.identifier).toBe('count');
    expect(choice.branches).toHaveLength(3);
    expect(choice.branches[0]!.identifier).toBe('0');
    expect(choice.branches[0]!.value).toEqual({ text: 'none' });
    expect(choice.branches[1]!.identifier).toBe('1');
    expect(choice.branches[1]!.value).toEqual({ text: 'one' });
    expect(choice.branches[2]!.identifier).toBe('other');
    expect(choice.branches[2]!.value).toEqual({ text: 'many' });
  });

  it('throws for a branch key ICU cannot express', () => {
    expect(() =>
      parser.parseCallExpression(
        expr("say.select(status, { 'in-stock': 'In stock', 'sold-out': 'Sold out' })"),
      ),
    ).toThrow("Invalid select branch key 'in-stock'");
  });

  // ICU `select` matches its cases as literal strings, so a numeric key is an
  // ordinary key there and stays bare, since `=0` would fail to parse
  it('keeps a numeric key bare on a select', () => {
    const result = parser.parseCallExpression(
      expr("say.select(tier, { 0: 'Free', other: 'Paid' })"),
    );
    expect(result!.toICUString()).toBe('{tier, select,\n  0 {Free}\n  other {Paid}\n}');
  });

  it('returns null when the callee is not a say expression', () => {
    expect(parser.parseCallExpression(expr("other.plural(count, { other: 'x' })"))).toBeNull();
  });

  it('returns null when the first argument is not an expression', () => {
    expect(parser.parseCallExpression(expr("say.plural(...args, { other: 'x' })"))).toBeNull();
  });

  it('returns null when the second argument is not an object', () => {
    expect(parser.parseCallExpression(expr('say.plural(count, notObject)'))).toBeNull();
  });

  it('skips choice properties that are not plain object properties', () => {
    const result = parser.parseCallExpression(expr("say.plural(count, { ...rest, other: 'x' })"));
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.branches).toHaveLength(1);
    expect(choice.branches[0]!.identifier).toBe('other');
  });

  it('ignores descriptor spread properties when reading id/context', () => {
    const result = parser.parseCallExpression(
      expr("say({ ...rest, id: 'kept' }).plural(count, { other: 'x' })"),
    );
    expect(result!.descriptor).toEqual({ id: 'kept', context: undefined });
  });
});

describe('parseExpression', () => {
  it('delegates to the tagged template parser', () => {
    const result = parser.parseExpression(expr('say`Hello`'));
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(CompositeMessage);
  });

  it('delegates to the call expression parser', () => {
    const result = parser.parseExpression(
      expr("say.plural(count, { one: 'item', other: 'items' })"),
    );
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(CompositeMessage);
  });

  it('returns an argument message for fallback=true with a simple identifier', () => {
    const result = parser.parseExpression(expr('name'), true);
    expect(result).toBeInstanceOf(ArgumentMessage);
    expect((result as ArgumentMessage).identifier).toBe('name');
  });

  it('returns an argument message for fallback=true with a complex expression', () => {
    const result = parser.parseExpression(expr('obj.prop'), true);
    expect(result).toBeInstanceOf(ArgumentMessage);
    expect((result as ArgumentMessage).identifier).toBe(AUTO_INCREMENT_IDENTIFIER);
  });

  it('returns null for fallback=false with a non-say expression', () => {
    expect(parser.parseExpression(expr('name'), false)).toBeNull();
  });

  it('handles nested expressions in tagged templates', () => {
    const result = parser.parseExpression(expr('say`Hello ${user.name}!`'));
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(CompositeMessage);
    expect(result!.children).toHaveLength(3);
    expect(result!.children[1]).toBeInstanceOf(ArgumentMessage);
    expect((result!.children[1] as ArgumentMessage).identifier).toBe(AUTO_INCREMENT_IDENTIFIER);
  });
});

describe('unwrapPlaceholder', () => {
  it('names a value written as a single-key object', () => {
    const object = expr<t.ObjectExpression>('({ cartTotal: getTotal() })');
    const property = object.properties[0] as t.ObjectProperty;
    expect(parser.unwrapPlaceholder(object)).toEqual(['cartTotal', property.value]);
  });

  it('names a template interpolation the value would otherwise number', () => {
    const result = parser.parseExpression(expr('say`Total: ${{ cartTotal: getTotal() }}`'));
    const argument = result!.children[1] as ArgumentMessage;
    expect(argument.identifier).toBe('cartTotal');
    // The wrapper is gone, only the value it held is compiled
    expect(t.isCallExpression(argument.expression)).toBe(true);
    expect(((argument.expression as t.CallExpression).callee as t.Identifier).name).toBe(
      'getTotal',
    );
  });

  it('accepts a quoted key and a shorthand property', () => {
    expect(parser.unwrapPlaceholder(expr("({ 'cartTotal': x })"))[0]).toBe('cartTotal');
    expect(parser.unwrapPlaceholder(expr('({ total })'))[0]).toBe('total');
  });

  it.each([
    ['a name that is not a valid identifier', "({ 'cart-total': x })"],
    ['a numeric name', '({ 0: x })'],
  ])('throws for %s', (_, code) => {
    expect(() => parser.unwrapPlaceholder(expr(code))).toThrow('Invalid placeholder name');
  });

  it.each([
    ['more than one key', '({ a: 1, b: 2 })'],
    ['no keys', '({})'],
    ['a computed key', '({ [key]: x })'],
    ['a spread', '({ ...rest })'],
    ['a method', '({ a() {} })'],
  ])('leaves an object with %s untouched', (_, code) => {
    // Only the one shape that could not already mean something is claimed
    const object = expr<t.ObjectExpression>(code);
    expect(parser.unwrapPlaceholder(object)).toEqual([AUTO_INCREMENT_IDENTIFIER, object]);
  });

  it('passes a plain expression through as it always was', () => {
    const identifier = expr('name');
    expect(parser.unwrapPlaceholder(identifier)).toEqual(['name', identifier]);
    const member = expr('obj.prop');
    expect(parser.unwrapPlaceholder(member)).toEqual([AUTO_INCREMENT_IDENTIFIER, member]);
  });

  it('names a choice selector', () => {
    const result = parser.parseExpression(
      expr("say.plural({ n: items.length }, { one: '# item', other: '# items' })"),
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.identifier).toBe('n');
    expect(t.isMemberExpression(choice.expression)).toBe(true);
  });

  it('keeps a named `say` macro a message of its own', () => {
    const result = parser.parseExpression(expr('say`Hi ${{ nested: say`there` }}`'));
    // The name is dropped rather than applied to a nested message, but no macro
    // survives into the output
    expect(result!.children[1]).toBeInstanceOf(CompositeMessage);
  });
});

describe('isEquivalentPlaceholder, on values', () => {
  it('treats the same variable interpolated twice as one value', () => {
    expect(parser.isEquivalentPlaceholder(expr('name'), expr('name'))).toBe(true);
  });

  it('treats the same member chain written twice as one value', () => {
    expect(parser.isEquivalentPlaceholder(expr('author.name'), expr('author.name'))).toBe(true);
  });

  it('treats a variable and a member chain as distinguishable', () => {
    // The shape `${name}` beside `${{ name: author.name }}` reduces to
    expect(parser.isEquivalentPlaceholder(expr('name'), expr('author.name'))).toBe(false);
  });

  it('treats different member chains as distinguishable', () => {
    expect(parser.isEquivalentPlaceholder(expr('items.length'), expr('users.length'))).toBe(false);
  });

  it('ignores where in the source each one was written', () => {
    // The same expression written at two points in a message parses to nodes
    // that differ in position, which must not make them two placeholders
    const a = expr('cart.total');
    const b = expr('  cart.total');
    expect(a.start).not.toBe(b.start);
    expect(parser.isEquivalentPlaceholder(a, b)).toBe(true);
  });

  it('treats anything that is not a node as distinguishable', () => {
    expect(parser.isEquivalentPlaceholder(null, null)).toBe(false);
    expect(parser.isEquivalentPlaceholder(expr('name'), undefined)).toBe(false);
  });
});

describe('collectLeadingComments', () => {
  // The JSX parser reaches these paths through this package, so they are
  // exercised here against the source rather than the built dependency
  function collect(code: string, find: (node: t.Node) => boolean) {
    const ast = parse(code, {
      sourceType: 'module',
      sourceFilename: 'test.tsx',
      plugins: ['typescript', 'jsx'],
      attachComment: true,
      tokens: true,
      ranges: true,
    });

    let comments: readonly t.Comment[] = [];
    traverse(ast, {
      enter(path) {
        if (!find(path.node)) return;
        comments = parser.collectLeadingComments(path);
        path.stop();
      },
    });
    return comments.map((c) => c.value.trim());
  }

  const say = (node: t.Node) => t.isTaggedTemplateExpression(node);
  const element = (node: t.Node) =>
    t.isJSXElement(node) &&
    t.isJSXIdentifier(node.openingElement.name) &&
    node.openingElement.name.name === 'Say';

  it('walks out to the statement holding the message', () => {
    expect(collect('// a note\nconst a = say`Hi`;', say)).toEqual(['a note']);
  });

  it('walks out through an export to the declaration it wraps', () => {
    expect(collect('// a note\nexport const a = say`Hi`;', say)).toEqual(['a note']);
  });

  it('stops at the statement', () => {
    expect(collect('// a note\nfunction f() {\n  return say`Hi`;\n}', say)).toEqual([]);
  });

  it('reads a comment child in front of a JSX message', () => {
    expect(collect('const x = <p>{/* a note */}<Say>Hi</Say></p>;', element)).toEqual(['a note']);
  });

  it('reads a comment child in front of a JSX message in a fragment', () => {
    expect(collect('const x = <>{/* a note */}<Say>Hi</Say></>;', element)).toEqual(['a note']);
  });

  it('reads through the whitespace laying out the markup', () => {
    expect(
      collect('const x = (\n  <p>\n    {/* a note */}\n    <Say>Hi</Say>\n  </p>\n);', element),
    ).toEqual(['a note']);
  });

  it('stops at a child that is not a comment', () => {
    expect(collect('const x = <p>{/* a note */}<b>x</b><Say>Hi</Say></p>;', element)).toEqual([]);
  });

  it('stops at an expression child holding something other than a comment', () => {
    expect(collect('const x = <p>{/* a note */}{value}<Say>Hi</Say></p>;', element)).toEqual([]);
  });

  it('reads an empty expression child that holds no comment as nothing', () => {
    expect(collect('const x = <p>{}<Say>Hi</Say></p>;', element)).toEqual([]);
  });

  it('does not reach out of a child list to the statement around it', () => {
    expect(collect('// a note\nconst x = <p><Say>Hi</Say></p>;', element)).toEqual([]);
  });

  it('reports a comment once when an ancestor already carries it', () => {
    // The transformer assigns what this collects back on to the node, so a
    // second pass over the same tree must not double the comment up
    const ast = parse('// a note\nconst a = say`Hi`;', {
      sourceType: 'module',
      attachComment: true,
      tokens: true,
      ranges: true,
    });

    let collected: readonly t.Comment[] = [];
    traverse(ast, {
      Expression(path) {
        path.node.leadingComments = parser.collectLeadingComments(path);
        if (t.isTaggedTemplateExpression(path.node)) collected = path.node.leadingComments;
      },
    });
    expect(collected.map((c) => c.value.trim())).toEqual(['a note']);
  });
});
