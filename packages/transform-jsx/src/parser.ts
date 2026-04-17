import * as t from '@babel/types';
import {
  ArgumentMessage,
  AUTO_INCREMENT_IDENTIFIER,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  LiteralMessage,
  type Message,
} from '@saykit/config/features/messages';

export function parseJSXContainerElement(element: t.JSXElement): CompositeMessage | null {
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
      c.push(parseJSXElement(e, true));
    } else if (t.isJSXFragment(e)) {
      c.push(new ElementMessage(AUTO_INCREMENT_IDENTIFIER, [], e));
    } else if (t.isJSXExpressionContainer(e)) {
      if (t.isExpression(e.expression))
        c.push(new ArgumentMessage(getExpressionAsIdentifier(e.expression), e.expression));
    }

    return c;
  }, []);

  const descriptorId = findAttributeValueIfStringLiteralAsString(
    element.openingElement.attributes,
    'id',
  );
  const descriptorContext = findAttributeValueIfStringLiteralAsString(
    element.openingElement.attributes,
    'context',
  );

  return new CompositeMessage(
    { id: descriptorId, context: descriptorContext },
    [],
    [],
    children,
    accessor as t.Expression,
  );
}

export function parseJSXOpeningElement(element: t.JSXOpeningElement): CompositeMessage | null {
  if (!element.selfClosing) return null;
  const processed = processJSXOpeningElement(element);
  if (!processed) return null;
  const [accessor, kind] = processed;

  if (typeof kind === 'string' && ['select', 'ordinal', 'plural'].includes(kind)) {
    const branches = element.attributes.reduce<{ identifier: string; value: Message }[]>((b, a) => {
      if (!t.isJSXAttribute(a)) return b;

      let identifier = getAttributeNameAsString(a);
      if (identifier === '_' || identifier === 'id' || identifier === 'context') return b;
      if (
        identifier.startsWith('_') &&
        identifier.length > 1 &&
        !Number.isNaN(+identifier.slice(1))
      )
        identifier = identifier.slice(1);

      if (t.isStringLiteral(a.value)) {
        b.push({ identifier, value: new LiteralMessage(a.value.value) });
      } else if (t.isLiteral(a.value)) {
        b.push({ identifier, value: new ArgumentMessage(identifier, a.value) });
      } else if (t.isJSXExpressionContainer(a.value)) {
        if (t.isJSXElement(a.value.expression)) {
          b.push({
            identifier,
            value: parseJSXElement(a.value.expression, true),
          });
        } else if (t.isJSXFragment(a.value.expression)) {
          b.push({
            identifier,
            value: new ElementMessage(AUTO_INCREMENT_IDENTIFIER, [], a.value.expression),
          });
        } else if (t.isExpression(a.value.expression)) {
          b.push({
            identifier,
            value: new ArgumentMessage(
              getExpressionAsIdentifier(a.value.expression),
              a.value.expression,
            ),
          });
        }
      }

      return b;
    }, []);

    const initialiser = findAttributeValueIfExpressionOrStringLiteral(element.attributes, '_');
    if (!initialiser) return null;
    const identifier = getExpressionAsIdentifier(initialiser);
    const choice = new ChoiceMessage(kind, identifier, branches, initialiser);

    const descriptorId = findAttributeValueIfStringLiteralAsString(element.attributes, 'id');
    const descriptorContext = findAttributeValueIfStringLiteralAsString(
      element.attributes,
      'context',
    );

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

export function parseJSXElement(element: t.JSXElement, fallback?: false): CompositeMessage | null;
export function parseJSXElement(
  element: t.JSXElement,
  fallback: true,
): CompositeMessage | ElementMessage;
export function parseJSXElement(element: t.JSXElement, fallback?: boolean): Message | null {
  const message = element.openingElement.selfClosing
    ? parseJSXOpeningElement(element.openingElement)
    : parseJSXContainerElement(element);

  if (message) return message;
  if (!fallback) return null;

  if (element.openingElement.selfClosing)
    return new ElementMessage(AUTO_INCREMENT_IDENTIFIER, [], element);

  const fake = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('Say'), []),
    t.jsxClosingElement(t.jsxIdentifier('Say')),
    element.children,
  );
  const wrapped = parseJSXElement(fake, true);
  if (wrapped) return new ElementMessage(AUTO_INCREMENT_IDENTIFIER, [wrapped], element);

  return null;
}

function getAttributeNameAsString(attribute: t.JSXAttribute) {
  if (t.isJSXIdentifier(attribute.name)) return attribute.name.name;
  if (t.isJSXNamespacedName(attribute.name)) return attribute.name.name.name;
  return undefined as never;
}

function findAttributeValueIfStringLiteralAsString(
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[],
  identifier: string,
) {
  for (const attribute of attributes) {
    if (!t.isJSXAttribute(attribute)) continue;
    if (t.isJSXIdentifier(attribute.name) && attribute.name.name === identifier) {
      if (t.isStringLiteral(attribute.value)) return attribute.value.value;
    }
  }
  return undefined;
}

function findAttributeValueIfExpressionOrStringLiteral(
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[],
  identifier: string,
) {
  for (const attribute of attributes) {
    if (!t.isJSXAttribute(attribute)) continue;
    if (t.isJSXIdentifier(attribute.name) && attribute.name.name === identifier) {
      if (t.isJSXExpressionContainer(attribute.value) && t.isExpression(attribute.value.expression))
        return attribute.value.expression;
      if (t.isStringLiteral(attribute.value)) return attribute.value;
    }
  }
  return undefined;
}

function getExpressionAsIdentifier(node: t.Node) {
  if (t.isIdentifier(node)) return node.name;
  if (t.isJSXIdentifier(node)) return node.name;
  return AUTO_INCREMENT_IDENTIFIER;
}
