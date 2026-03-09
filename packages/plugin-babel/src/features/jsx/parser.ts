import * as t from '@babel/types';
import type { Context } from '~/core/context.js';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  LiteralMessage,
  type Message,
} from '~/core/messages/types.js';
import { getExpressionAsKey } from '../js/parser.js';

export function parseJSXContainerElement(
  context: Context,
  element: t.JSXElement,
): CompositeMessage | null {
  if (element.openingElement.selfClosing) return null;
  const processed = processJSXOpeningElement(element.openingElement);
  if (!processed) return null;
  const [accessor] = processed;

  const children = element.children.reduce<Message[]>((c, e) => {
    if (t.isJSXText(e)) {
      const text = e.value.replace(/\s+/g, ' ');
      c.push(new LiteralMessage(text));
    }

    if (t.isJSXElement(e)) {
      c.push(parseJSXElement(context, e, true));
    }
    //
    else if (t.isJSXFragment(e)) {
      c.push(new ElementMessage(context.identifierStore.next(), [], e));
    }
    //
    else if (t.isJSXExpressionContainer(e)) {
      if (t.isExpression(e.expression))
        c.push(new ArgumentMessage(getExpressionAsKey(context, e.expression), e.expression));
    }

    return c;
  }, []);

  const descriptorId = //
    findAttributeValueIfStringLiteralAsString(element.openingElement.attributes, 'id');
  const descriptorContext = //
    findAttributeValueIfStringLiteralAsString(element.openingElement.attributes, 'context');

  return new CompositeMessage(
    { id: descriptorId, context: descriptorContext },
    [],
    [],
    children,
    accessor as t.Expression,
  );
}

export function parseJSXOpeningElement(
  context: Context,
  element: t.JSXOpeningElement,
): CompositeMessage | null {
  if (!element.selfClosing) return null;
  const processed = processJSXOpeningElement(element);
  if (!processed) return null;
  const [accessor, kind] = processed;

  if (typeof kind === 'string' && ['select', 'ordinal', 'plural'].includes(kind)) {
    const branches = element.attributes.reduce<{ key: string; value: Message }[]>((b, a) => {
      if (!t.isJSXAttribute(a)) return b;

      let key = getAttributeNameAsString(a);
      if (key === '_' || key === 'id' || key === 'context') return b;
      if (key.startsWith('_') && key.length > 1 && !Number.isNaN(+key.slice(1))) key = key.slice(1);

      if (t.isStringLiteral(a.value)) {
        b.push({ key, value: new LiteralMessage(a.value.value) });
      }
      //
      else if (t.isLiteral(a.value)) {
        b.push({ key, value: new ArgumentMessage(key, a.value) });
      }
      //
      else if (t.isJSXExpressionContainer(a.value)) {
        if (t.isJSXElement(a.value.expression)) {
          b.push({
            key,
            value: parseJSXElement(context, a.value.expression, true),
          });
        }
        //
        else if (t.isJSXFragment(a.value.expression)) {
          b.push({
            key,
            value: new ElementMessage(context.identifierStore.next(), [], a.value.expression),
          });
        }
        //
        else if (t.isExpression(a.value.expression)) {
          b.push({
            key,
            value: new ArgumentMessage(
              getExpressionAsKey(context, a.value.expression),
              a.value.expression,
            ),
          });
        }
      }

      return b;
    }, []);

    const initialiser = //
      findAttributeValueIfExpressionOrStringLiteral(element.attributes, '_')!;
    const identifier = getExpressionAsKey(context, initialiser);
    const choice = new ChoiceMessage(kind, identifier, branches, initialiser);

    const descriptorId = //
      findAttributeValueIfStringLiteralAsString(element.attributes, 'id');
    const descriptorContext = //
      findAttributeValueIfStringLiteralAsString(element.attributes, 'context');

    return new CompositeMessage(
      { id: descriptorId, context: descriptorContext },
      [],
      [],
      [choice],
      accessor as t.Expression,
    );
  }

  return null;
}

//

function processJSXOpeningElement(element: t.JSXOpeningElement): [t.Node, string | null] | null {
  if (t.isJSXIdentifier(element.name) && element.name.name === 'Say') {
    return [element.name, null];
  }

  if (
    t.isJSXMemberExpression(element.name) &&
    t.isJSXIdentifier(element.name.object) &&
    element.name.object.name === 'Say' &&
    t.isJSXIdentifier(element.name.property)
  ) {
    return [element.name.object, element.name.property.name.toLowerCase()];
  }

  return null;
}

//

export function parseJSXElement(
  context: Context,
  element: t.JSXElement,
  fallback?: false,
): CompositeMessage | null;
export function parseJSXElement(
  context: Context,
  element: t.JSXElement,
  fallback: true,
): CompositeMessage | ElementMessage;
export function parseJSXElement(
  context: Context,
  element: t.JSXElement,
  fallback?: boolean,
): Message | null {
  const message = element.openingElement.selfClosing
    ? parseJSXOpeningElement(context, element.openingElement)
    : parseJSXContainerElement(context, element);

  if (message) return message;
  if (!fallback) return null;

  if (element.openingElement.selfClosing)
    return new ElementMessage(context.identifierStore.next(), [], element);

  const preload = context.identifierStore.next();
  const fake = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('Say'), []),
    t.jsxClosingElement(t.jsxIdentifier('Say')),
    element.children,
  );
  const wrapped = parseJSXElement(context, fake, true);
  if (wrapped) return new ElementMessage(preload, [wrapped], element);
  context.identifierStore.back();

  return null;
}

function getAttributeNameAsString(attribute: t.JSXAttribute) {
  if (t.isJSXIdentifier(attribute.name)) return attribute.name.name;
  if (t.isJSXNamespacedName(attribute.name)) return attribute.name.name.name;
  return undefined as never;
}

function findAttributeValueIfStringLiteralAsString(
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[],
  key: string,
) {
  for (const attribute of attributes) {
    if (!t.isJSXAttribute(attribute)) continue;
    if (t.isJSXIdentifier(attribute.name) && attribute.name.name === key) {
      if (t.isStringLiteral(attribute.value)) return attribute.value.value;
    }
  }
  return undefined;
}

function findAttributeValueIfExpressionOrStringLiteral(
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[],
  key: string,
) {
  for (const attribute of attributes) {
    if (!t.isJSXAttribute(attribute)) continue;
    if (t.isJSXIdentifier(attribute.name) && attribute.name.name === key) {
      if (t.isJSXExpressionContainer(attribute.value) && t.isExpression(attribute.value.expression))
        return attribute.value.expression;
      if (t.isStringLiteral(attribute.value)) return attribute.value;
    }
  }
  return undefined;
}
