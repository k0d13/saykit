import * as t from '@babel/types';
import {
  ArgumentMessage,
  AUTO_INCREMENT_IDENTIFIER,
  ChoiceMessage,
  CompositeMessage,
  LiteralMessage,
} from '@saykit/config/features/messages';
import { describe, expect, it } from 'vitest';
import * as parser from './parser.js';

describe('processExpression', () => {
  it('should process simple "say" identifier', () => {
    const identifier = t.identifier('say');
    const result = parser.processExpression(identifier);

    expect(result).toEqual([identifier, null, null]);
  });

  it('should process "say" with descriptor object call', () => {
    const sayIdentifier = t.identifier('say');
    const descriptorObject = t.objectExpression([]);
    const callExpression = t.callExpression(sayIdentifier, [descriptorObject]);

    const result = parser.processExpression(callExpression);

    expect(result).toEqual([sayIdentifier, descriptorObject, null]);
  });

  it('should process member expression with selector', () => {
    const sayIdentifier = t.identifier('say');
    const selectorIdentifier = t.identifier('plural');
    const memberExpression = t.memberExpression(sayIdentifier, selectorIdentifier);

    const result = parser.processExpression(memberExpression);

    expect(result).toEqual([sayIdentifier, null, 'plural']);
  });

  it('should process nested member expression with descriptor', () => {
    const sayIdentifier = t.identifier('say');
    const descriptorObject = t.objectExpression([]);
    const sayCall = t.callExpression(sayIdentifier, [descriptorObject]);
    const selectorIdentifier = t.identifier('select');
    const memberExpression = t.memberExpression(sayCall, selectorIdentifier);

    const result = parser.processExpression(memberExpression);

    expect(result).toEqual([sayIdentifier, descriptorObject, 'select']);
  });

  it('should return null for non-say expressions', () => {
    const identifier = t.identifier('notSay');
    const result = parser.processExpression(identifier);

    expect(result).toBeNull();
  });

  it('should return null for complex expressions not matching pattern', () => {
    const sayIdentifier = t.identifier('say');
    const invalidCall = t.callExpression(sayIdentifier, [
      t.stringLiteral('too'),
      t.stringLiteral('many'),
    ]);

    const result = parser.processExpression(invalidCall);

    expect(result).toEqual([sayIdentifier, null, null]);
  });
});

describe('parseTaggedTemplateExpression', () => {
  it('should parse simple tagged template', () => {
    const sayIdentifier = t.identifier('say');
    const quasi = t.templateElement({ raw: 'Hello', cooked: 'Hello' }, false);
    const taggedTemplate = t.taggedTemplateExpression(
      sayIdentifier,
      t.templateLiteral([quasi], []),
    );

    const result = parser.parseTaggedTemplateExpression(taggedTemplate);

    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(1);
    expect(result!.children[0]).toEqual({ text: 'Hello' });
  });

  it('should parse tagged template with expressions', () => {
    const sayIdentifier = t.identifier('say');
    const quasi1 = t.templateElement({ raw: 'Hello ', cooked: 'Hello ' }, false);
    const quasi2 = t.templateElement({ raw: '!', cooked: '!' }, true);
    const expression = t.identifier('name');
    const taggedTemplate = t.taggedTemplateExpression(
      sayIdentifier,
      t.templateLiteral([quasi1, quasi2], [expression]),
    );

    const result = parser.parseTaggedTemplateExpression(taggedTemplate);

    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(3);
    expect(result!.children[0]).toBeInstanceOf(LiteralMessage);
    expect(result!.children[0]).toEqual({ text: 'Hello ' });
    expect(result!.children[1]).toBeInstanceOf(ArgumentMessage);
    expect((result!.children[1] as ArgumentMessage).identifier).toBe('name');
    expect(result!.children[2]).toBeInstanceOf(LiteralMessage);
    expect(result!.children[2]).toEqual({ text: '!' });
  });

  it('should parse tagged template with descriptor', () => {
    const sayIdentifier = t.identifier('say');
    const descriptorObject = t.objectExpression([
      t.objectProperty(t.identifier('id'), t.stringLiteral('greeting')),
    ]);
    const sayCall = t.callExpression(sayIdentifier, [descriptorObject]);

    const quasi = t.templateElement({ raw: 'Hello', cooked: 'Hello' }, false);
    const taggedTemplate = t.taggedTemplateExpression(sayCall, t.templateLiteral([quasi], []));

    const result = parser.parseTaggedTemplateExpression(taggedTemplate);

    expect(result).not.toBeNull();
    expect(result!.descriptor).toEqual({ id: 'greeting', context: undefined });
  });

  it('should parse tagged template with context', () => {
    const sayIdentifier = t.identifier('say');
    const descriptorObject = t.objectExpression([
      t.objectProperty(t.identifier('context'), t.stringLiteral('greeting')),
    ]);
    const sayCall = t.callExpression(sayIdentifier, [descriptorObject]);

    const quasi = t.templateElement({ raw: 'Hello', cooked: 'Hello' }, false);
    const taggedTemplate = t.taggedTemplateExpression(sayCall, t.templateLiteral([quasi], []));

    const result = parser.parseTaggedTemplateExpression(taggedTemplate);

    expect(result).not.toBeNull();
    expect(result!.descriptor).toEqual({ id: undefined, context: 'greeting' });
  });

  it('should extract translator comments', () => {
    const sayIdentifier = t.identifier('say');
    const quasi = t.templateElement({ raw: 'Hello', cooked: 'Hello' }, false);
    const taggedTemplate = t.taggedTemplateExpression(
      sayIdentifier,
      t.templateLiteral([quasi], []),
    );

    // Add translator comment
    taggedTemplate.leadingComments = [
      { type: 'CommentLine', value: ' Translators: Use formal greeting' },
      {
        type: 'CommentBlock',
        value: ' Translators: Consider cultural context',
      },
    ] as t.Comment[];

    const result = parser.parseTaggedTemplateExpression(taggedTemplate);

    expect(result).not.toBeNull();
    expect(result!.comments).toEqual(['Use formal greeting', 'Consider cultural context']);
  });

  it('should include location information', () => {
    const sayIdentifier = t.identifier('say');
    const quasi = t.templateElement({ raw: 'Hello', cooked: 'Hello' }, false);
    const taggedTemplate = t.taggedTemplateExpression(
      sayIdentifier,
      t.templateLiteral([quasi], []),
    );

    // Add location info
    taggedTemplate.loc = {
      start: { line: 10, column: 5, index: 0 },
      end: { line: 10, column: 20, index: 15 },
      filename: 'test.js',
      identifierName: undefined,
    };

    const result = parser.parseTaggedTemplateExpression(taggedTemplate);

    expect(result).not.toBeNull();
    expect(result!.references).toEqual(['test.js:10']);
  });

  it('should return null for non-say tagged templates', () => {
    const notSayIdentifier = t.identifier('notSay');
    const quasi = t.templateElement({ raw: 'Hello', cooked: 'Hello' }, false);
    const taggedTemplate = t.taggedTemplateExpression(
      notSayIdentifier,
      t.templateLiteral([quasi], []),
    );

    const result = parser.parseTaggedTemplateExpression(taggedTemplate);

    expect(result).toBeNull();
  });
});

describe('parseCallExpression', () => {
  it('should parse simple plural call expression', () => {
    const sayIdentifier = t.identifier('say');
    const pluralMember = t.memberExpression(sayIdentifier, t.identifier('plural'));
    const countIdentifier = t.identifier('count');
    const choicesObject = t.objectExpression([
      t.objectProperty(t.stringLiteral('one'), t.stringLiteral('item')),
      t.objectProperty(t.stringLiteral('other'), t.stringLiteral('items')),
    ]);
    const callExpression = t.callExpression(pluralMember, [countIdentifier, choicesObject]);

    const result = parser.parseCallExpression(callExpression);

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

  it('should parse ordinal call expression', () => {
    const sayIdentifier = t.identifier('say');
    const ordinalMember = t.memberExpression(sayIdentifier, t.identifier('ordinal'));
    const positionIdentifier = t.identifier('position');
    const choicesObject = t.objectExpression([
      t.objectProperty(t.stringLiteral('1'), t.stringLiteral('first')),
      t.objectProperty(t.stringLiteral('2'), t.stringLiteral('second')),
      t.objectProperty(t.stringLiteral('other'), t.stringLiteral('other')),
    ]);
    const callExpression = t.callExpression(ordinalMember, [positionIdentifier, choicesObject]);

    const result = parser.parseCallExpression(callExpression);

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

  it('should parse select call expression', () => {
    const sayIdentifier = t.identifier('say');
    const selectMember = t.memberExpression(sayIdentifier, t.identifier('select'));
    const genderIdentifier = t.identifier('gender');
    const choicesObject = t.objectExpression([
      t.objectProperty(t.stringLiteral('male'), t.stringLiteral('He')),
      t.objectProperty(t.stringLiteral('female'), t.stringLiteral('She')),
      t.objectProperty(t.stringLiteral('other'), t.stringLiteral('They')),
    ]);
    const callExpression = t.callExpression(selectMember, [genderIdentifier, choicesObject]);

    const result = parser.parseCallExpression(callExpression);

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

  it('should parse choices with nested expressions', () => {
    const sayIdentifier = t.identifier('say');
    const pluralMember = t.memberExpression(sayIdentifier, t.identifier('plural'));
    const countIdentifier = t.identifier('count');
    const nestedExpression = t.identifier('name');
    const choicesObject = t.objectExpression([
      t.objectProperty(t.stringLiteral('one'), nestedExpression),
    ]);
    const callExpression = t.callExpression(pluralMember, [countIdentifier, choicesObject]);

    const result = parser.parseCallExpression(callExpression);

    expect(result).not.toBeNull();
    const choiceMessage = result!.children[0] as ChoiceMessage;
    expect(choiceMessage).toBeInstanceOf(ChoiceMessage);
    expect(choiceMessage.kind).toBe('plural');
    expect(choiceMessage.identifier).toBe('count');
    expect(choiceMessage.branches).toHaveLength(1);
    expect(choiceMessage.branches[0]!.identifier).toBe('one');
    expect(choiceMessage.branches[0]!.value).toBeInstanceOf(ArgumentMessage);
    expect((choiceMessage.branches[0]!.value as ArgumentMessage).identifier).toBe('name');
  });

  it('should parse choices with descriptor', () => {
    const sayIdentifier = t.identifier('say');
    const descriptorObject = t.objectExpression([
      t.objectProperty(t.identifier('id'), t.stringLiteral('itemCount')),
    ]);
    const sayCall = t.callExpression(sayIdentifier, [descriptorObject]);
    const pluralMember = t.memberExpression(sayCall, t.identifier('plural'));
    const countIdentifier = t.identifier('count');
    const choicesObject = t.objectExpression([
      t.objectProperty(t.stringLiteral('one'), t.stringLiteral('item')),
      t.objectProperty(t.stringLiteral('other'), t.stringLiteral('items')),
    ]);
    const callExpression = t.callExpression(pluralMember, [countIdentifier, choicesObject]);

    const result = parser.parseCallExpression(callExpression);

    expect(result).not.toBeNull();
    expect(result!.descriptor).toEqual({ id: 'itemCount', context: undefined });
  });

  it('should return null for non-choice call expressions', () => {
    const sayIdentifier = t.identifier('say');
    const someMember = t.memberExpression(sayIdentifier, t.identifier('something'));
    const callExpression = t.callExpression(someMember, []);

    const result = parser.parseCallExpression(callExpression);

    expect(result).toBeNull();
  });

  it('should return null for malformed choice expressions', () => {
    const sayIdentifier = t.identifier('say');
    const pluralMember = t.memberExpression(sayIdentifier, t.identifier('plural'));
    // Missing required arguments
    const callExpression = t.callExpression(pluralMember, []);

    const result = parser.parseCallExpression(callExpression);

    expect(result).toBeNull();
  });

  it('should handle numeric identifiers as exact matches', () => {
    const sayIdentifier = t.identifier('say');
    const pluralMember = t.memberExpression(sayIdentifier, t.identifier('plural'));
    const countIdentifier = t.identifier('count');
    const choicesObject = t.objectExpression([
      t.objectProperty(t.numericLiteral(0), t.stringLiteral('none')),
      t.objectProperty(t.numericLiteral(1), t.stringLiteral('one')),
      t.objectProperty(t.stringLiteral('other'), t.stringLiteral('many')),
    ]);
    const callExpression = t.callExpression(pluralMember, [countIdentifier, choicesObject]);

    const result = parser.parseCallExpression(callExpression);

    expect(result).not.toBeNull();
    const choiceMessage = result!.children[0] as ChoiceMessage;
    expect(choiceMessage).toBeInstanceOf(ChoiceMessage);
    expect(choiceMessage.kind).toBe('plural');
    expect(choiceMessage.identifier).toBe('count');
    expect(choiceMessage.branches).toHaveLength(3);
    expect(choiceMessage.branches[0]!.identifier).toBe('0');
    expect(choiceMessage.branches[0]!.value).toEqual({ text: 'none' });
    expect(choiceMessage.branches[1]!.identifier).toBe('1');
    expect(choiceMessage.branches[1]!.value).toEqual({ text: 'one' });
    expect(choiceMessage.branches[2]!.identifier).toBe('other');
    expect(choiceMessage.branches[2]!.value).toEqual({ text: 'many' });
  });
});

describe('parseExpression', () => {
  it('should delegate to tagged template parser', () => {
    const sayIdentifier = t.identifier('say');
    const quasi = t.templateElement({ raw: 'Hello', cooked: 'Hello' }, false);
    const taggedTemplate = t.taggedTemplateExpression(
      sayIdentifier,
      t.templateLiteral([quasi], []),
    );

    const result = parser.parseExpression(taggedTemplate);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(CompositeMessage);
  });

  it('should delegate to call expression parser', () => {
    const sayIdentifier = t.identifier('say');
    const pluralMember = t.memberExpression(sayIdentifier, t.identifier('plural'));
    const countIdentifier = t.identifier('count');
    const choicesObject = t.objectExpression([
      t.objectProperty(t.stringLiteral('one'), t.stringLiteral('item')),
      t.objectProperty(t.stringLiteral('other'), t.stringLiteral('items')),
    ]);
    const callExpression = t.callExpression(pluralMember, [countIdentifier, choicesObject]);

    const result = parser.parseExpression(callExpression);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(CompositeMessage);
  });

  it('should return argument message for fallback=true with simple identifier', () => {
    const identifier = t.identifier('name');

    const result = parser.parseExpression(identifier, true);

    expect(result).toBeInstanceOf(ArgumentMessage);
    expect((result as ArgumentMessage).identifier).toBe('name');
  });

  it('should return argument message for fallback=true with complex expression', () => {
    const expression = t.memberExpression(t.identifier('obj'), t.identifier('prop'));

    const result = parser.parseExpression(expression, true);

    expect(result).toBeInstanceOf(ArgumentMessage);
    expect((result as ArgumentMessage).identifier).toBe(AUTO_INCREMENT_IDENTIFIER);
  });

  it('should return null for fallback=false with non-say expression', () => {
    const identifier = t.identifier('name');

    const result = parser.parseExpression(identifier, false);

    expect(result).toBeNull();
  });

  it('should handle nested expressions in tagged templates', () => {
    const sayIdentifier = t.identifier('say');
    const complexExpression = t.memberExpression(t.identifier('user'), t.identifier('name'));
    const quasi1 = t.templateElement({ raw: 'Hello ', cooked: 'Hello ' }, false);
    const quasi2 = t.templateElement({ raw: '!', cooked: '!' }, true);
    const taggedTemplate = t.taggedTemplateExpression(
      sayIdentifier,
      t.templateLiteral([quasi1, quasi2], [complexExpression]),
    );

    const result = parser.parseExpression(taggedTemplate);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Object); // CompositeMessage
    if (result) {
      expect(result.children).toHaveLength(3);
      expect(result.children[1]).toBeInstanceOf(ArgumentMessage);
      expect((result.children[1] as ArgumentMessage).identifier).toBe(AUTO_INCREMENT_IDENTIFIER);
    }
  });
});
