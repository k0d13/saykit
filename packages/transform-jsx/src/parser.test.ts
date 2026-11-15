import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import {
  ArgumentMessage,
  assignSequenceIdentifiers,
  AUTO_INCREMENT_IDENTIFIER,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  LiteralMessage,
} from '@saykit/config/messages';
import { isEquivalentPlaceholder } from '@saykit/transform-js/parser';
import { describe, expect, it } from 'vitest';
import * as parser from './parser.js';

// Parse a snippet of real JSX into its element node, the way the transformer
// does (see index.ts): the `jsx` plugin is what makes `<Say />` an expression
function jsx(strings: TemplateStringsArray): t.JSXElement {
  return parseExpression(strings.join(''), {
    plugins: ['jsx', 'typescript'],
  }) as unknown as t.JSXElement;
}

describe('parseJSXContainerElement', () => {
  it('returns null for self-closing elements', () => {
    expect(parser.parseJSXContainerElement(jsx`<Say />`)).toBeNull();
  });

  it('returns null for non-Say elements', () => {
    expect(parser.parseJSXContainerElement(jsx`<div></div>`)).toBeNull();
  });

  it('parses text children as LiteralMessage', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say>Hello</Say>`);
    expect(result).toBeInstanceOf(CompositeMessage);
    expect(result!.children[0]).toEqual(new LiteralMessage('Hello'));
  });

  // Whitespace normalisation is covered end-to-end in `whitespace.test.ts`,
  // where the assertions read as the catalogue strings it produces

  it('parses expression children as ArgumentMessage', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say>{name}</Say>`);
    expect(result!.children[0]).toBeInstanceOf(ArgumentMessage);
    expect((result!.children[0] as ArgumentMessage).identifier).toBe('name');
  });

  // A fragment renders no element, so an empty one leaves nothing behind
  it('parses an empty fragment child as no child at all', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say><></></Say>`);
    expect(result!.children).toEqual([]);
  });

  it('parses nested JSX children as ElementMessage (non-Say fallback)', () => {
    const result = parser.parseJSXContainerElement(jsx`
      <Say>
        <strong>bold</strong>
      </Say>
    `);
    expect(result!.children[0]).toBeInstanceOf(ElementMessage);
  });

  it('reads id and context descriptor attributes', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say id="msg" context="nav">Hi</Say>`);
    expect(result!.descriptor).toEqual({ id: 'msg', context: 'nav' });
  });

  it('drops text children that are only a line break and indentation', () => {
    const result = parser.parseJSXContainerElement(jsx`
      <Say>
        {name}
      </Say>
    `);
    expect(result!.children).toHaveLength(1);
    expect(result!.children[0]).toBeInstanceOf(ArgumentMessage);
  });

  it('parses a literal string expression as text, folded into its neighbour', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say>Hello,{' '}world</Say>`);
    expect(result!.children).toEqual([new LiteralMessage('Hello, world')]);
  });

  // A spread child renders an unknown number of unknown things, so there is
  // nothing to name it or to translate around it
  it('ignores spread children', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say>{...items}</Say>`);
    expect(result!.children).toHaveLength(0);
  });

  it('ignores expression containers that hold no expression', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say>{/* empty */}</Say>`);
    expect(result!.children).toHaveLength(0);
  });

  it('ignores an id attribute whose value is not a string literal', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say id={dynamic}>Hi</Say>`);
    expect(result!.descriptor.id).toBeUndefined();
  });

  // A formatted argument is a fragment, not a whole message, so the shape that
  // matters most is the nested one
  it('parses a nested formatted argument inside a container', () => {
    const result = parser.parseJSXContainerElement(
      jsx`<Say>You have <Say.number _={items.length} /> items</Say>`,
    );
    assignSequenceIdentifiers(result!);
    expect(result!.toICUString()).toBe('You have {0, number} items');
  });

  it('leaves descriptor and whitespace undefined when attributes are absent', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say>Hi</Say>`);
    expect(result!.descriptor).toEqual({ id: undefined, context: undefined });
    expect(result!.whitespace).toBeUndefined();
  });

  it('ignores spread attributes when reading descriptors and whitespace', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say {...rest} id="msg">Hi</Say>`);
    expect(result!.descriptor).toEqual({ id: 'msg', context: undefined });
    expect(result!.whitespace).toBeUndefined();
  });

  // Only a boolean literal (or the bare attribute) sets it; anything else is
  // only known at runtime, too late to change what is extracted
  it.each([
    ['whitespace', true],
    ['whitespace={true}', true],
    ['whitespace={false}', false],
    ['whitespace={dynamic}', undefined],
  ])('reads `%s` as %s', (attribute, expected) => {
    const element = parseExpression(`<Say ${attribute}>Hi</Say>`, {
      plugins: ['jsx', 'typescript'],
    }) as unknown as t.JSXElement;
    expect(parser.parseJSXContainerElement(element)!.whitespace).toBe(expected);
  });
});

describe('parseJSXOpeningElement', () => {
  it('returns null for non-self-closing elements', () => {
    expect(parser.parseJSXOpeningElement(jsx`<Say></Say>`.openingElement)).toBeNull();
  });

  it('returns null for non-Say elements', () => {
    expect(parser.parseJSXOpeningElement(jsx`<div />`.openingElement)).toBeNull();
  });

  it('returns null for unknown Say member (e.g. Say.foo)', () => {
    expect(parser.parseJSXOpeningElement(jsx`<Say.foo />`.openingElement)).toBeNull();
  });

  it('returns null when _ initialiser attribute is missing', () => {
    expect(parser.parseJSXOpeningElement(jsx`<Say.plural one="item" />`.openingElement)).toBeNull();
  });

  it('parses Say.plural with string literal branches', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`
      <Say.plural _={count} one="item" other="items" />
    `.openingElement,
    );
    expect(result).toBeInstanceOf(CompositeMessage);
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice).toBeInstanceOf(ChoiceMessage);
    expect(choice.kind).toBe('plural');
    expect(choice.identifier).toBe('count');
    expect(choice.branches).toHaveLength(2);
    expect(choice.branches[0]).toEqual({ identifier: 'one', value: new LiteralMessage('item') });
    expect(choice.branches[1]).toEqual({ identifier: 'other', value: new LiteralMessage('items') });
  });

  it('parses Say.select and Say.ordinal variants', () => {
    const select = parser.parseJSXOpeningElement(jsx`<Say.select _={val} a="A" />`.openingElement);
    expect((select!.children[0] as ChoiceMessage).kind).toBe('select');

    const ordinal = parser.parseJSXOpeningElement(
      jsx`<Say.ordinal _={val} a="A" />`.openingElement,
    );
    expect((ordinal!.children[0] as ChoiceMessage).kind).toBe('ordinal');
  });

  it('parses a plural offset', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`<Say.plural _={count} offset={1} one="you and # other" other="you and # others" />`
        .openingElement,
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.offset).toBe(1);
    expect(choice.branches.map((b) => b.identifier)).toEqual(['one', 'other']);
  });

  it('leaves the offset undefined when absent', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`<Say.plural _={count} other="#" />`.openingElement,
    );
    expect((result!.children[0] as ChoiceMessage).offset).toBeUndefined();
  });

  // `select` has no number to offset, so `offset` there is an ordinary branch
  it('treats offset as a branch key on select', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`<Say.select _={kind} offset="Offset" other="Other" />`.openingElement,
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.offset).toBeUndefined();
    expect(choice.branches.map((b) => b.identifier)).toEqual(['offset', 'other']);
  });

  it.each(['offset="1"', 'offset={n}', 'offset={1.5}'])('ignores a non-literal %s', (offset) => {
    const element = parseExpression(`<Say.plural _={count} ${offset} other="#" />`, {
      plugins: ['jsx', 'typescript'],
    }) as unknown as t.JSXElement;
    const result = parser.parseJSXOpeningElement(element.openingElement);
    expect((result!.children[0] as ChoiceMessage).offset).toBeUndefined();
  });

  it('parses Say.number', () => {
    const result = parser.parseJSXOpeningElement(jsx`<Say.number _={total} />`.openingElement);
    expect(result).toBeInstanceOf(CompositeMessage);
    const argument = result!.children[0] as ArgumentMessage;
    expect(argument).toBeInstanceOf(ArgumentMessage);
    expect(argument.identifier).toBe('total');
    expect(argument.format).toEqual({ type: 'number', style: undefined });
  });

  it('parses Say.number with a style', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`<Say.number _={level} style="percent" />`.openingElement,
    );
    expect((result!.children[0] as ArgumentMessage).format).toEqual({
      type: 'number',
      style: 'percent',
    });
  });

  it.each(['date', 'time'] as const)('parses Say.%s with a style', (kind) => {
    const element = parseExpression(`<Say.${kind} _={when} style="medium" />`, {
      plugins: ['jsx', 'typescript'],
    }) as unknown as t.JSXElement;
    const result = parser.parseJSXOpeningElement(element.openingElement);
    expect((result!.children[0] as ArgumentMessage).format).toEqual({
      type: kind,
      style: 'medium',
    });
  });

  it('names a formatted placeholder written as a single-key object', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`<Say.number _={{ cartTotal: getTotal() }} />`.openingElement,
    );
    expect((result!.children[0] as ArgumentMessage).identifier).toBe('cartTotal');
  });

  it('returns null when a formatted argument has no _ initialiser', () => {
    expect(
      parser.parseJSXOpeningElement(jsx`<Say.number style="percent" />`.openingElement),
    ).toBeNull();
  });

  it('rejects a style the formatter cannot honour', () => {
    expect(() =>
      parser.parseJSXOpeningElement(jsx`<Say.date _={when} style="meduim" />`.openingElement),
    ).toThrow("Invalid date style 'meduim'");
  });

  it('ignores a style that is not a string literal', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`<Say.number _={n} style={dynamic} />`.openingElement,
    );
    expect((result!.children[0] as ArgumentMessage).format).toEqual({
      type: 'number',
      style: undefined,
    });
  });

  it('strips leading underscore from numeric branch names (e.g. _0 → 0)', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`
      <Say.plural _={count} _0="zero" other="many" />
    `.openingElement,
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.branches[0]!.identifier).toBe('0');
  });

  it('accepts a JSX element expression as a branch value', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`
      <Say.plural _={count} one={<b>Bold</b>} />
    `.openingElement,
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.branches[0]!.value).toBeInstanceOf(ElementMessage);
  });

  // A fragment is the sentence itself rather than an element in it, so its
  // children are the branch, which is how a case interpolates its selector
  it('reads a JSX fragment branch value as the branch content', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`
      <Say.plural _={count} one={<>{count} day</>} />
    `.openingElement,
    );
    const choice = result!.children[0] as ChoiceMessage;
    const branch = choice.branches[0]!.value as CompositeMessage;
    expect(branch).toBeInstanceOf(CompositeMessage);
    expect((branch.children[0] as ArgumentMessage).identifier).toBe('count');
    expect((branch.children[1] as LiteralMessage).text).toBe(' day');
  });

  // A fragment renders no element, so it is content rather than a tag, and its
  // children belong to the sentence that encloses it
  it('folds a nested fragment into the children around it', () => {
    const result = parser.parseJSXContainerElement(jsx`<Say>Hello <>brave {name}</>!</Say>`);
    const message = result!;
    expect((message.children[0] as LiteralMessage).text).toBe('Hello brave ');
    expect((message.children[1] as ArgumentMessage).identifier).toBe('name');
    expect((message.children[2] as LiteralMessage).text).toBe('!');
  });

  it('skips branch attributes with no value', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`
      <Say.plural _={count} one other="items" />
    `.openingElement,
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.branches).toHaveLength(1);
    expect(choice.branches[0]!.identifier).toBe('other');
  });

  it('skips branch attributes whose container holds no expression', () => {
    // Real JSX forbids an empty attribute expression (`one={}`), so the empty
    // container is injected directly onto an otherwise-parsed element
    const opening = jsx`<Say.plural _={count} other="items" />`.openingElement;
    opening.attributes.push(
      t.jsxAttribute(t.jsxIdentifier('one'), t.jsxExpressionContainer(t.jsxEmptyExpression())),
    );
    const choice = parser.parseJSXOpeningElement(opening)!.children[0] as ChoiceMessage;
    expect(choice.branches).toHaveLength(1);
    expect(choice.branches[0]!.identifier).toBe('other');
  });

  it('returns null when the `_` initialiser has no usable value', () => {
    expect(
      parser.parseJSXOpeningElement(jsx`<Say.plural _ one="item" />`.openingElement),
    ).toBeNull();
  });

  it('accepts an expression as a branch value (ArgumentMessage)', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`
      <Say.plural _={count} one={label} />
    `.openingElement,
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.branches[0]!.value).toBeInstanceOf(ArgumentMessage);
  });

  it('reads id and context descriptor attributes', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`
      <Say.plural id="item-count" context="shop" _={count} one="item" />
    `.openingElement,
    );
    expect(result!.descriptor).toEqual({ id: 'item-count', context: 'shop' });
  });

  it('ignores spread attributes among the branches and descriptors', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`
      <Say.plural {...rest} _={count} one="item" />
    `.openingElement,
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.identifier).toBe('count');
    expect(choice.branches).toHaveLength(1);
    expect(choice.branches[0]!.identifier).toBe('one');
  });

  it('reads the branch name from a namespaced attribute', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`
      <Say.plural _={count} ns:one="item" />
    `.openingElement,
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.branches[0]!.identifier).toBe('one');
  });

  it('accepts a string-literal `_` initialiser (auto-increment identifier)', () => {
    const result = parser.parseJSXOpeningElement(
      jsx`<Say.plural _="count" one="item" />`.openingElement,
    );
    const choice = result!.children[0] as ChoiceMessage;
    expect(choice.identifier).toBe(AUTO_INCREMENT_IDENTIFIER);
  });
});

describe('parseJSXElement', () => {
  it('delegates to container parser for non-self-closing Say', () => {
    const result = parser.parseJSXElement(jsx`<Say>Hi</Say>`);
    expect(result).toBeInstanceOf(CompositeMessage);
    expect((result as CompositeMessage).children[0]).toEqual(new LiteralMessage('Hi'));
  });

  it('delegates to opening parser for self-closing Say.plural', () => {
    const result = parser.parseJSXElement(jsx`<Say.plural _={n} one="item" />`);
    expect((result as CompositeMessage).children[0]).toBeInstanceOf(ChoiceMessage);
  });

  it('returns null (no fallback) for unrecognised element', () => {
    expect(parser.parseJSXElement(jsx`<span />`)).toBeNull();
  });

  it('returns ElementMessage (fallback=true) for unrecognised self-closing element', () => {
    expect(parser.parseJSXElement(jsx`<br />`, true)).toBeInstanceOf(ElementMessage);
  });

  it('returns ElementMessage (fallback=true) for unrecognised container element', () => {
    expect(parser.parseJSXElement(jsx`<span>text</span>`, true)).toBeInstanceOf(ElementMessage);
  });

  describe('say-tag', () => {
    it('names a container element after its tag', () => {
      const result = parser.parseJSXElement(jsx`<a say-tag="link">here</a>`, true);
      expect((result as ElementMessage).identifier).toBe('link');
    });

    it('names a self-closing element after its tag', () => {
      const result = parser.parseJSXElement(jsx`<ChevronDown say-tag="icon" />`, true);
      expect((result as ElementMessage).identifier).toBe('icon');
    });

    it('strips the attribute so it never reaches the rendered element', () => {
      const element = jsx`<a href="/x" say-tag="link">here</a>`;
      const result = parser.parseJSXElement(element, true) as ElementMessage;
      const attributes = (result.expression as t.JSXElement).openingElement.attributes;
      expect(attributes.map((a) => ((a as t.JSXAttribute).name as t.JSXIdentifier).name)).toEqual([
        'href',
      ]);
    });

    it('accepts a string literal in an expression container', () => {
      const element = jsx`<a href="/x" say-tag={'link'}>here</a>`;
      const result = parser.parseJSXElement(element, true) as ElementMessage;
      expect(result.identifier).toBe('link');
      // The attribute is consumed just as the bare-literal form is
      const attributes = (result.expression as t.JSXElement).openingElement.attributes;
      expect(attributes.map((a) => ((a as t.JSXAttribute).name as t.JSXIdentifier).name)).toEqual([
        'href',
      ]);
    });

    it('ignores a tag that is not a static string', () => {
      const element = jsx`<a say-tag={name}>here</a>`;
      const result = parser.parseJSXElement(element, true) as ElementMessage;
      expect(result.identifier).toBe(AUTO_INCREMENT_IDENTIFIER);
      // A dynamic value is left alone rather than silently dropped
      expect((result.expression as t.JSXElement).openingElement.attributes).toHaveLength(1);
    });

    it('falls back to auto-increment when there is no tag', () => {
      const result = parser.parseJSXElement(jsx`<a href="/x">here</a>`, true);
      expect((result as ElementMessage).identifier).toBe(AUTO_INCREMENT_IDENTIFIER);
    });

    it('throws for a tag that is not a valid identifier', () => {
      expect(() => parser.parseJSXElement(jsx`<a say-tag="my link">here</a>`, true)).toThrow(
        "Invalid 'say-tag' value 'my link'",
      );
    });

    it('names elements nested inside a Say container', () => {
      const result = parser.parseJSXContainerElement(
        jsx`<Say>Click <a say-tag="link">here</a></Say>`,
      );
      expect((result!.children[1] as ElementMessage).identifier).toBe('link');
    });
  });
});

// The comparison itself lives in `@saykit/transform-js` so both transformers
// share one rule; the element half of it is exercised here, where the JSX is
describe('isEquivalentPlaceholder, on elements', () => {
  // The children differ throughout: they come from the translation, so they
  // never make two elements distinguishable
  it('treats elements with the same name and props as equivalent', () => {
    expect(isEquivalentPlaceholder(jsx`<b className="x">a</b>`, jsx`<b className="x">c</b>`)).toBe(
      true,
    );
  });

  it('treats differing props as distinguishable', () => {
    expect(isEquivalentPlaceholder(jsx`<a href="/x">a</a>`, jsx`<a href="/y">a</a>`)).toBe(false);
  });

  it('treats differing element names as distinguishable', () => {
    expect(isEquivalentPlaceholder(jsx`<b>a</b>`, jsx`<i>a</i>`)).toBe(false);
  });

  it('treats a self-closing element as distinct from a container', () => {
    expect(isEquivalentPlaceholder(jsx`<Icon />`, jsx`<Icon>a</Icon>`)).toBe(false);
  });

  it('treats a non-element expression as distinguishable', () => {
    expect(isEquivalentPlaceholder(null, jsx`<b>a</b>`)).toBe(false);
  });

  it('never matches an element against a value, whichever side it is on', () => {
    const value = parseExpression('user.name') as unknown as t.Expression;
    expect(isEquivalentPlaceholder(jsx`<b>a</b>`, value)).toBe(false);
    expect(isEquivalentPlaceholder(value, jsx`<b>a</b>`)).toBe(false);
  });
});
