import * as t from '@babel/types';
import {
  ArgumentMessage,
  ChoiceMessage,
  ElementMessage,
  LiteralMessage,
} from '@saykit/config/features/messages';
import { describe, expect, it } from 'vitest';
import * as parser from './parser.js';

describe('parseJSXContainerElement', () => {
  it('should parse simple JSX Say container element', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);
    const closingElement = t.jsxClosingElement(sayIdentifier);
    const helloText = t.jsxText('Hello World');
    const jsxElement = t.jsxElement(openingElement, closingElement, [helloText]);

    const result = parser.parseJSXContainerElement(jsxElement);

    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(1);
    expect(result!.children[0]).toBeInstanceOf(LiteralMessage);
    expect(result!.children[0]).toEqual({ text: 'Hello World' });
  });

  it('should parse JSX container with expressions', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);
    const closingElement = t.jsxClosingElement(sayIdentifier);
    const helloText = t.jsxText('Hello ');
    const nameExpression = t.jsxExpressionContainer(t.identifier('name'));
    const exclamationText = t.jsxText('!');
    const jsxElement = t.jsxElement(openingElement, closingElement, [
      helloText,
      nameExpression,
      exclamationText,
    ]);

    const result = parser.parseJSXContainerElement(jsxElement);

    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(3);
    expect(result!.children[0]).toBeInstanceOf(LiteralMessage);
    expect(result!.children[0]).toEqual({ text: 'Hello ' });
    expect(result!.children[1]).toBeInstanceOf(ArgumentMessage);
    expect((result!.children[1] as ArgumentMessage).identifier).toBe('name');
    expect(result!.children[2]).toBeInstanceOf(LiteralMessage);
    expect(result!.children[2]).toEqual({ text: '!' });
  });

  it('should parse JSX container with nested elements', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);
    const closingElement = t.jsxClosingElement(sayIdentifier);
    const helloText = t.jsxText('Hello ');

    // Nested element
    const strongIdentifier = t.jsxIdentifier('strong');
    const strongOpening = t.jsxOpeningElement(strongIdentifier, [], false);
    const strongClosing = t.jsxClosingElement(strongIdentifier);
    const strongText = t.jsxText('World');
    const strongElement = t.jsxElement(strongOpening, strongClosing, [strongText]);

    const jsxElement = t.jsxElement(openingElement, closingElement, [helloText, strongElement]);

    const result = parser.parseJSXContainerElement(jsxElement);

    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(2);
    expect(result!.children[0]).toBeInstanceOf(LiteralMessage);
    expect(result!.children[0]).toEqual({ text: 'Hello ' });
    expect(result!.children[1]).toBeInstanceOf(ElementMessage);
  });

  it('should parse JSX container with fragments', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);
    const closingElement = t.jsxClosingElement(sayIdentifier);
    const helloText = t.jsxText('Hello ');

    // Fragment
    const fragment = t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
      t.jsxText('World'),
    ]);

    const jsxElement = t.jsxElement(openingElement, closingElement, [helloText, fragment]);

    const result = parser.parseJSXContainerElement(jsxElement);

    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(2);
    expect(result!.children[0]).toBeInstanceOf(LiteralMessage);
    expect(result!.children[0]).toEqual({ text: 'Hello ' });
    expect(result!.children[1]).toBeInstanceOf(ElementMessage);
  });

  it('should parse JSX container with descriptor id', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const idAttribute = t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral('greeting'));
    const openingElement = t.jsxOpeningElement(sayIdentifier, [idAttribute], false);
    const closingElement = t.jsxClosingElement(sayIdentifier);
    const helloText = t.jsxText('Hello');
    const jsxElement = t.jsxElement(openingElement, closingElement, [helloText]);

    const result = parser.parseJSXContainerElement(jsxElement);

    expect(result).not.toBeNull();
    expect(result!.descriptor).toEqual({ id: 'greeting', context: undefined });
  });

  it('should parse JSX container with descriptor context', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const contextAttribute = t.jsxAttribute(
      t.jsxIdentifier('context'),
      t.stringLiteral('greeting'),
    );
    const openingElement = t.jsxOpeningElement(sayIdentifier, [contextAttribute], false);
    const closingElement = t.jsxClosingElement(sayIdentifier);
    const helloText = t.jsxText('Hello');
    const jsxElement = t.jsxElement(openingElement, closingElement, [helloText]);

    const result = parser.parseJSXContainerElement(jsxElement);

    expect(result).not.toBeNull();
    expect(result!.descriptor).toEqual({ id: undefined, context: 'greeting' });
  });

  it('should return null for self-closing elements', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const openingElement = t.jsxOpeningElement(sayIdentifier, [], true);
    const jsxElement = t.jsxElement(openingElement, null, []);

    const result = parser.parseJSXContainerElement(jsxElement);

    expect(result).toBeNull();
  });

  it('should return null for non-Say elements', () => {
    const divIdentifier = t.jsxIdentifier('div');
    const openingElement = t.jsxOpeningElement(divIdentifier, [], false);
    const closingElement = t.jsxClosingElement(divIdentifier);
    const helloText = t.jsxText('Hello');
    const jsxElement = t.jsxElement(openingElement, closingElement, [helloText]);

    const result = parser.parseJSXContainerElement(jsxElement);

    expect(result).toBeNull();
  });

  it('should normalize whitespace in JSX text', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);
    const closingElement = t.jsxClosingElement(sayIdentifier);
    const whitespaceText = t.jsxText('\n  Hello,  \n  World!  \n');
    const jsxElement = t.jsxElement(openingElement, closingElement, [whitespaceText]);

    const result = parser.parseJSXContainerElement(jsxElement);

    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(1);
    expect(result!.children[0]).toBeInstanceOf(LiteralMessage);
    expect((result!.children[0] as LiteralMessage).text).toBe(' Hello, World! ');
  });
});

describe('parseJSXOpeningElement', () => {
  it('should parse plural self-closing element', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const pluralProperty = t.jsxIdentifier('plural');
    const sayMember = t.jsxMemberExpression(sayIdentifier, pluralProperty);

    const countAttribute = t.jsxAttribute(
      t.jsxIdentifier('_'),
      t.jsxExpressionContainer(t.identifier('count')),
    );
    const oneAttribute = t.jsxAttribute(t.jsxIdentifier('one'), t.stringLiteral('item'));
    const otherAttribute = t.jsxAttribute(t.jsxIdentifier('other'), t.stringLiteral('items'));

    const openingElement = t.jsxOpeningElement(
      sayMember,
      [countAttribute, oneAttribute, otherAttribute],
      true,
    );

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(1);
    const choiceMessage = result!.children[0] as ChoiceMessage;
    expect(choiceMessage).toBeInstanceOf(ChoiceMessage);
    expect(choiceMessage.kind).toBe('plural');
    expect(choiceMessage.identifier).toBe('count');
    expect(choiceMessage.branches).toHaveLength(2);
    expect(choiceMessage.branches[0]!.identifier).toBe('one');
    expect(choiceMessage.branches[0]!.value).toEqual({ text: 'item' });
    expect(choiceMessage.branches[1]!.identifier).toBe('other');
    expect(choiceMessage.branches[1]!.value).toEqual({ text: 'items' });
  });

  it('should parse select self-closing element', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const selectProperty = t.jsxIdentifier('select');
    const sayMember = t.jsxMemberExpression(sayIdentifier, selectProperty);

    const genderAttribute = t.jsxAttribute(
      t.jsxIdentifier('_'),
      t.jsxExpressionContainer(t.identifier('gender')),
    );
    const maleAttribute = t.jsxAttribute(t.jsxIdentifier('male'), t.stringLiteral('He'));
    const femaleAttribute = t.jsxAttribute(t.jsxIdentifier('female'), t.stringLiteral('She'));
    const otherAttribute = t.jsxAttribute(t.jsxIdentifier('other'), t.stringLiteral('They'));

    const openingElement = t.jsxOpeningElement(
      sayMember,
      [genderAttribute, maleAttribute, femaleAttribute, otherAttribute],
      true,
    );

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).not.toBeNull();
    const choiceMessage = result!.children[0] as ChoiceMessage;
    expect(choiceMessage).toBeInstanceOf(ChoiceMessage);
    expect(choiceMessage.kind).toBe('select');
    expect(choiceMessage.identifier).toBe('gender');
    expect(choiceMessage.branches).toHaveLength(3);
    expect(choiceMessage.branches[0]!.identifier).toBe('male');
    expect(choiceMessage.branches[0]!.value).toEqual({ text: 'He' });
    expect(choiceMessage.branches[1]!.identifier).toBe('female');
    expect(choiceMessage.branches[1]!.value).toEqual({ text: 'She' });
    expect(choiceMessage.branches[2]!.identifier).toBe('other');
    expect(choiceMessage.branches[2]!.value).toEqual({ text: 'They' });
  });

  it('should parse ordinal self-closing element', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const ordinalProperty = t.jsxIdentifier('ordinal');
    const sayMember = t.jsxMemberExpression(sayIdentifier, ordinalProperty);

    const positionAttribute = t.jsxAttribute(
      t.jsxIdentifier('_'),
      t.jsxExpressionContainer(t.identifier('position')),
    );
    const firstAttribute = t.jsxAttribute(t.jsxIdentifier('1'), t.stringLiteral('first'));
    const secondAttribute = t.jsxAttribute(t.jsxIdentifier('2'), t.stringLiteral('second'));
    const otherAttribute = t.jsxAttribute(t.jsxIdentifier('other'), t.stringLiteral('other'));

    const openingElement = t.jsxOpeningElement(
      sayMember,
      [positionAttribute, firstAttribute, secondAttribute, otherAttribute],
      true,
    );

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).not.toBeNull();
    const choiceMessage = result!.children[0] as ChoiceMessage;
    expect(choiceMessage).toBeInstanceOf(ChoiceMessage);
    expect(choiceMessage.kind).toBe('ordinal');
    expect(choiceMessage.identifier).toBe('position');
    expect(choiceMessage.branches).toHaveLength(3);
    expect(choiceMessage.branches[0]!.identifier).toBe('1');
    expect(choiceMessage.branches[0]!.value).toEqual({ text: 'first' });
    expect(choiceMessage.branches[1]!.identifier).toBe('2');
    expect(choiceMessage.branches[1]!.value).toEqual({ text: 'second' });
    expect(choiceMessage.branches[2]!.identifier).toBe('other');
    expect(choiceMessage.branches[2]!.value).toEqual({ text: 'other' });
  });

  it('should handle literal values in attributes', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const pluralProperty = t.jsxIdentifier('plural');
    const sayMember = t.jsxMemberExpression(sayIdentifier, pluralProperty);

    const countAttribute = t.jsxAttribute(
      t.jsxIdentifier('_'),
      t.jsxExpressionContainer(t.identifier('count')),
    );
    const zeroAttribute = t.jsxAttribute(t.jsxIdentifier('0'), t.stringLiteral('none'));
    const oneAttribute = t.jsxAttribute(t.jsxIdentifier('one'), t.stringLiteral('single'));
    const otherAttribute = t.jsxAttribute(t.jsxIdentifier('other'), t.stringLiteral('many'));

    const openingElement = t.jsxOpeningElement(
      sayMember,
      [countAttribute, zeroAttribute, oneAttribute, otherAttribute],
      true,
    );

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).not.toBeNull();
    const choiceMessage = result!.children[0] as ChoiceMessage;
    expect(choiceMessage.branches).toHaveLength(3);
    expect(choiceMessage.branches[0]!.identifier).toBe('0');
    expect(choiceMessage.branches[0]!.value).toEqual({ text: 'none' });
    expect(choiceMessage.branches[1]!.identifier).toBe('one');
    expect(choiceMessage.branches[1]!.value).toEqual({ text: 'single' });
    expect(choiceMessage.branches[2]!.identifier).toBe('other');
    expect(choiceMessage.branches[2]!.value).toEqual({ text: 'many' });
  });

  it('should handle numeric attribute keys', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const pluralProperty = t.jsxIdentifier('plural');
    const sayMember = t.jsxMemberExpression(sayIdentifier, pluralProperty);

    const countAttribute = t.jsxAttribute(
      t.jsxIdentifier('_'),
      t.jsxExpressionContainer(t.identifier('count')),
    );
    const _1Attribute = t.jsxAttribute(t.jsxIdentifier('_1'), t.stringLiteral('first'));
    const _2Attribute = t.jsxAttribute(t.jsxIdentifier('_2'), t.stringLiteral('second'));

    const openingElement = t.jsxOpeningElement(
      sayMember,
      [countAttribute, _1Attribute, _2Attribute],
      true,
    );

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).not.toBeNull();
    const choiceMessage = result!.children[0] as ChoiceMessage;
    expect(choiceMessage.branches).toHaveLength(2);
    expect(choiceMessage.branches[0]!.identifier).toBe('1');
    expect(choiceMessage.branches[0]!.value).toEqual({ text: 'first' });
    expect(choiceMessage.branches[1]!.identifier).toBe('2');
    expect(choiceMessage.branches[1]!.value).toEqual({ text: 'second' });
  });

  it('should handle expression values in attributes', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const pluralProperty = t.jsxIdentifier('plural');
    const sayMember = t.jsxMemberExpression(sayIdentifier, pluralProperty);

    const countAttribute = t.jsxAttribute(
      t.jsxIdentifier('_'),
      t.jsxExpressionContainer(t.identifier('count')),
    );
    const oneAttribute = t.jsxAttribute(
      t.jsxIdentifier('one'),
      t.jsxExpressionContainer(t.identifier('itemText')),
    );

    const openingElement = t.jsxOpeningElement(sayMember, [countAttribute, oneAttribute], true);

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).not.toBeNull();
    const choiceMessage = result!.children[0] as ChoiceMessage;
    expect(choiceMessage.branches).toHaveLength(1);
    expect(choiceMessage.branches[0]!.identifier).toBe('one');
    expect(choiceMessage.branches[0]!.value).toBeInstanceOf(ArgumentMessage);
    expect((choiceMessage.branches[0]!.value as ArgumentMessage).identifier).toBe('itemText');
  });

  it('should handle nested elements in attributes', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const pluralProperty = t.jsxIdentifier('plural');
    const sayMember = t.jsxMemberExpression(sayIdentifier, pluralProperty);

    const countAttribute = t.jsxAttribute(
      t.jsxIdentifier('_'),
      t.jsxExpressionContainer(t.identifier('count')),
    );

    // Nested element in attribute
    const strongIdentifier = t.jsxIdentifier('strong');
    const strongOpening = t.jsxOpeningElement(strongIdentifier, [], false);
    const strongClosing = t.jsxClosingElement(strongIdentifier);
    const strongText = t.jsxText('Bold');
    const strongElement = t.jsxElement(strongOpening, strongClosing, [strongText]);
    const oneAttribute = t.jsxAttribute(
      t.jsxIdentifier('one'),
      t.jsxExpressionContainer(strongElement),
    );

    const openingElement = t.jsxOpeningElement(sayMember, [countAttribute, oneAttribute], true);

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).not.toBeNull();
    const choiceMessage = result!.children[0] as ChoiceMessage;
    expect(choiceMessage.branches).toHaveLength(1);
    expect(choiceMessage.branches[0]!.identifier).toBe('one');
    expect(choiceMessage.branches[0]!.value).toBeInstanceOf(ElementMessage);
  });

  it('should handle fragments in attributes', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const pluralProperty = t.jsxIdentifier('plural');
    const sayMember = t.jsxMemberExpression(sayIdentifier, pluralProperty);

    const countAttribute = t.jsxAttribute(
      t.jsxIdentifier('_'),
      t.jsxExpressionContainer(t.identifier('count')),
    );

    // Fragment in attribute
    const fragment = t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
      t.jsxText('Hello'),
      t.jsxText(' World'),
    ]);
    const oneAttribute = t.jsxAttribute(t.jsxIdentifier('one'), t.jsxExpressionContainer(fragment));

    const openingElement = t.jsxOpeningElement(sayMember, [countAttribute, oneAttribute], true);

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).not.toBeNull();
    const choiceMessage = result!.children[0] as ChoiceMessage;
    expect(choiceMessage.branches).toHaveLength(1);
    expect(choiceMessage.branches[0]!.identifier).toBe('one');
    expect(choiceMessage.branches[0]!.value).toBeInstanceOf(ElementMessage);
  });

  it('should parse with descriptor id', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const pluralProperty = t.jsxIdentifier('plural');
    const sayMember = t.jsxMemberExpression(sayIdentifier, pluralProperty);

    const idAttribute = t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral('itemCount'));
    const countAttribute = t.jsxAttribute(
      t.jsxIdentifier('_'),
      t.jsxExpressionContainer(t.identifier('count')),
    );
    const oneAttribute = t.jsxAttribute(t.jsxIdentifier('one'), t.stringLiteral('item'));

    const openingElement = t.jsxOpeningElement(
      sayMember,
      [idAttribute, countAttribute, oneAttribute],
      true,
    );

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).not.toBeNull();
    expect(result!.descriptor).toEqual({ id: 'itemCount', context: undefined });
  });

  it('should return null for non-choice elements', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const somethingProperty = t.jsxIdentifier('something');
    const sayMember = t.jsxMemberExpression(sayIdentifier, somethingProperty);

    const openingElement = t.jsxOpeningElement(sayMember, [], true);

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).toBeNull();
  });

  it('should return null for container elements', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).toBeNull();
  });

  it('should return null for non-Say elements', () => {
    const divIdentifier = t.jsxIdentifier('div');
    const openingElement = t.jsxOpeningElement(divIdentifier, [], true);

    const result = parser.parseJSXOpeningElement(openingElement);

    expect(result).toBeNull();
  });
});

describe('parseJSXElement', () => {
  it('should delegate to container parser for non-self-closing', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);
    const closingElement = t.jsxClosingElement(sayIdentifier);
    const helloText = t.jsxText('Hello');
    const jsxElement = t.jsxElement(openingElement, closingElement, [helloText]);

    const result = parser.parseJSXElement(jsxElement);

    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(1);
    expect(result!.children[0]).toBeInstanceOf(LiteralMessage);
    expect(result!.children[0]).toEqual({ text: 'Hello' });
  });

  it('should delegate to opening parser for self-closing', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const pluralProperty = t.jsxIdentifier('plural');
    const sayMember = t.jsxMemberExpression(sayIdentifier, pluralProperty);

    const countAttribute = t.jsxAttribute(
      t.jsxIdentifier('_'),
      t.jsxExpressionContainer(t.identifier('count')),
    );
    const oneAttribute = t.jsxAttribute(t.jsxIdentifier('one'), t.stringLiteral('item'));

    const openingElement = t.jsxOpeningElement(sayMember, [countAttribute, oneAttribute], true);
    const jsxElement = t.jsxElement(openingElement, null, []);

    const result = parser.parseJSXElement(jsxElement);

    expect(result).not.toBeNull();
    // Self-closing elements that match patterns return CompositeMessage with ChoiceMessage as child
    expect(result).toBeInstanceOf(Object); // CompositeMessage
    if (result && 'children' in result) {
      expect(result.children).toHaveLength(1);
      const choiceMessage = result.children[0] as ChoiceMessage;
      expect(choiceMessage).toBeInstanceOf(ChoiceMessage);
      expect(choiceMessage.kind).toBe('plural');
      expect(choiceMessage.identifier).toBe('count');
    } else {
      throw new Error('Expected CompositeMessage with ChoiceMessage child');
    }
  });

  it('should return element message for fallback=true with non-Say self-closing', () => {
    const strongIdentifier = t.jsxIdentifier('strong');
    const openingElement = t.jsxOpeningElement(strongIdentifier, [], true);
    const jsxElement = t.jsxElement(openingElement, null, []);

    const result = parser.parseJSXElement(jsxElement, true);

    expect(result).toBeInstanceOf(ElementMessage);
  });

  it('should return element message for fallback=true with non-Say container', () => {
    const strongIdentifier = t.jsxIdentifier('strong');
    const openingElement = t.jsxOpeningElement(strongIdentifier, [], false);
    const closingElement = t.jsxClosingElement(strongIdentifier);
    const helloText = t.jsxText('Hello');
    const jsxElement = t.jsxElement(openingElement, closingElement, [helloText]);

    const result = parser.parseJSXElement(jsxElement, true);

    expect(result).toBeInstanceOf(ElementMessage);
  });

  it('should return null for fallback=false with non-Say element', () => {
    const strongIdentifier = t.jsxIdentifier('strong');
    const openingElement = t.jsxOpeningElement(strongIdentifier, [], true);
    const jsxElement = t.jsxElement(openingElement, null, []);

    const result = parser.parseJSXElement(jsxElement, false);

    expect(result).toBeNull();
  });

  it('should wrap container element that fails parsing', () => {
    const sayIdentifier = t.jsxIdentifier('Say');
    const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);
    const closingElement = t.jsxClosingElement(sayIdentifier);
    // Empty children won't match any patterns
    const jsxElement = t.jsxElement(openingElement, closingElement, []);

    const result = parser.parseJSXElement(jsxElement, true);

    // This returns a CompositeMessage wrapping an ElementMessage
    expect(result).not.toBeNull();
    if (result && 'children' in result) {
      // Empty Say container results in empty children array
      expect(result.children).toHaveLength(0);
    } else {
      throw new Error('Expected CompositeMessage with children');
    }
  });
});
