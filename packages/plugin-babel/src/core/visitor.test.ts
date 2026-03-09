import * as t from '@babel/types';
import { describe, expect, it, vi } from 'vitest';
import { Context } from '~/core/context.js';
import { Visitor } from './visitor.js';

describe('Visitor', () => {
  const createMockContext = () => new Context([]);

  describe('Expression handler', () => {
    it('should process and replace tagged template expressions', () => {
      const context = createMockContext();
      const visitor = new Visitor(context);

      // Create a tagged template expression node
      const sayIdentifier = t.identifier('say');
      const quasi = t.templateElement({ raw: 'Hello World', cooked: 'Hello World' }, false);
      const taggedTemplate = t.taggedTemplateExpression(
        sayIdentifier,
        t.templateLiteral([quasi], []),
      );

      // Mock path object
      const path = {
        node: taggedTemplate,
        parent: {} as any,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      visitor.Expression(path as any);

      expect(path.replaceWith).toHaveBeenCalled();
      expect(path.skip).toHaveBeenCalled();
      expect(context.foundMessages).toHaveLength(1);
    });

    it('should process and replace call expressions', () => {
      const context = createMockContext();
      const visitor = new Visitor(context);

      // Create a plural call expression
      const sayIdentifier = t.identifier('say');
      const pluralMember = t.memberExpression(sayIdentifier, t.identifier('plural'));
      const countIdentifier = t.identifier('count');
      const choicesObject = t.objectExpression([
        t.objectProperty(t.stringLiteral('one'), t.stringLiteral('item')),
        t.objectProperty(t.stringLiteral('other'), t.stringLiteral('items')),
      ]);
      const callExpression = t.callExpression(pluralMember, [countIdentifier, choicesObject]);

      // Mock path object
      const path = {
        node: callExpression,
        parent: { leadingComments: [] } as any,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      visitor.Expression(path as any);

      expect(path.replaceWith).toHaveBeenCalled();
      expect(path.skip).toHaveBeenCalled();
      expect(context.foundMessages).toHaveLength(1);
    });

    it('should not process non-say expressions', () => {
      const context = createMockContext();
      const visitor = new Visitor(context);

      // Create a non-say expression
      const notSayIdentifier = t.identifier('console');
      const logMember = t.memberExpression(notSayIdentifier, t.identifier('log'));
      const callExpression = t.callExpression(logMember, [t.stringLiteral('test')]);

      // Mock path object
      const path = {
        node: callExpression,
        parent: {} as any,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      visitor.Expression(path as any);

      expect(path.replaceWith).not.toHaveBeenCalled();
      expect(path.skip).not.toHaveBeenCalled();
      expect(context.foundMessages).toHaveLength(0);
    });

    it('should copy leading comments from parent', () => {
      const context = createMockContext();
      const visitor = new Visitor(context);

      // Create parent with comments
      const leadingComments = [{ type: 'CommentLine', value: ' Some comment' }];

      const sayIdentifier = t.identifier('say');
      const quasi = t.templateElement({ raw: 'Hello', cooked: 'Hello' }, false);
      const taggedTemplate = t.taggedTemplateExpression(
        sayIdentifier,
        t.templateLiteral([quasi], []),
      );

      // Mock path object with parent comments
      const path = {
        node: taggedTemplate,
        parent: { leadingComments } as any,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      visitor.Expression(path as any);

      expect(path.node.leadingComments).toEqual(leadingComments);
    });

    it('should reset identifier store after processing', () => {
      const context = createMockContext();

      // Use identifier store to generate some IDs
      context.identifierStore.next();
      context.identifierStore.next();
      expect(context.identifierStore.next()).toBe('2');

      // Now process an expression
      const sayIdentifier = t.identifier('say');
      const quasi = t.templateElement({ raw: 'Hello', cooked: 'Hello' }, false);
      const taggedTemplate = t.taggedTemplateExpression(
        sayIdentifier,
        t.templateLiteral([quasi], []),
      );

      const path = {
        node: taggedTemplate,
        parent: {} as any,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      const visitor = new Visitor(context);
      visitor.Expression(path as any);

      // Identifier store should be reset
      expect(context.identifierStore.next()).toBe('0');
    });
  });

  describe('JSXElement handler', () => {
    it('should process and replace Say container elements', () => {
      const context = createMockContext();
      const visitor = new Visitor(context);

      // Create a Say container element
      const sayIdentifier = t.jsxIdentifier('Say');
      const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);
      const closingElement = t.jsxClosingElement(sayIdentifier);
      const helloText = t.jsxText('Hello World');
      const jsxElement = t.jsxElement(openingElement, closingElement, [helloText]);

      // Mock path object
      const path = {
        node: jsxElement,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      visitor.JSXElement(path as any);

      expect(path.replaceWith).toHaveBeenCalled();
      expect(path.skip).toHaveBeenCalled();
      expect(context.foundMessages).toHaveLength(1);
    });

    it('should process and replace Say self-closing elements', () => {
      const context = createMockContext();
      const visitor = new Visitor(context);

      // Create a Say plural self-closing element
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
      const jsxElement = t.jsxElement(openingElement, null, []);

      // Mock path object
      const path = {
        node: jsxElement,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      visitor.JSXElement(path as any);

      expect(path.replaceWith).toHaveBeenCalled();
      expect(path.skip).toHaveBeenCalled();
      expect(context.foundMessages).toHaveLength(1);
    });

    it('should not process non-Say JSX elements', () => {
      const context = createMockContext();
      const visitor = new Visitor(context);

      // Create a non-Say element
      const divIdentifier = t.jsxIdentifier('div');
      const openingElement = t.jsxOpeningElement(divIdentifier, [], false);
      const closingElement = t.jsxClosingElement(divIdentifier);
      const helloText = t.jsxText('Hello World');
      const jsxElement = t.jsxElement(openingElement, closingElement, [helloText]);

      // Mock path object
      const path = {
        node: jsxElement,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      visitor.JSXElement(path as any);

      expect(path.replaceWith).not.toHaveBeenCalled();
      expect(path.skip).not.toHaveBeenCalled();
      expect(context.foundMessages).toHaveLength(0);
    });

    it('should reset identifier store after processing', () => {
      const context = createMockContext();

      // Use identifier store to generate some IDs
      context.identifierStore.next();
      context.identifierStore.next();
      expect(context.identifierStore.next()).toBe('2');

      // Process a JSX element
      const sayIdentifier = t.jsxIdentifier('Say');
      const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);
      const closingElement = t.jsxClosingElement(sayIdentifier);
      const helloText = t.jsxText('Hello');
      const jsxElement = t.jsxElement(openingElement, closingElement, [helloText]);

      const path = {
        node: jsxElement,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      const visitor = new Visitor(context);
      visitor.JSXElement(path as any);

      // Identifier store should be reset
      expect(context.identifierStore.next()).toBe('0');
    });
  });

  describe('toHandlers', () => {
    it('should return properly structured handlers object', () => {
      const context = createMockContext();
      const visitor = new Visitor(context);

      const handlers = visitor.toHandlers();

      expect(handlers).toHaveProperty('Expression');
      expect(handlers).toHaveProperty('JSXElement');
      expect(typeof handlers.Expression).toBe('function');
      expect(typeof handlers.JSXElement).toBe('function');
    });

    it('should bind handlers to visitor instance', () => {
      const context = createMockContext();
      const visitor = new Visitor(context);

      const handlers = visitor.toHandlers();

      // Test that handlers are bound by checking they have access to instance context
      const expressionMockPath = {
        node: {} as any,
        parent: {} as any,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      // JSX handler needs a proper JSX element structure
      const sayIdentifier = t.jsxIdentifier('Say');
      const openingElement = t.jsxOpeningElement(sayIdentifier, [], false);
      const closingElement = t.jsxClosingElement(sayIdentifier);
      const jsxElement = t.jsxElement(openingElement, closingElement, []);

      const jsxMockPath = {
        node: jsxElement,
        replaceWith: vi.fn(),
        skip: vi.fn(),
      };

      // Calling handlers should not throw and should access the instance context
      expect(() => handlers.Expression(expressionMockPath as any)).not.toThrow();
      expect(() => handlers.JSXElement(jsxMockPath as any)).not.toThrow();
    });
  });
});
