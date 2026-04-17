import * as t from '@babel/types';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  AUTO_INCREMENT_IDENTIFIER,
  LiteralMessage,
  type Message,
} from '@saykit/config/features/messages';

export function parseTaggedTemplateExpression(
  tagged: t.TaggedTemplateExpression,
): CompositeMessage | null {
  const processed = processExpression(tagged.tag);
  if (!processed) return null;
  const [accessor, descriptor] = processed;

  const children = tagged.quasi.quasis.reduce<Message[]>((c, q, i) => {
    c.push(new LiteralMessage(q.value.cooked!));
    if (t.isExpression(tagged.quasi.expressions[i]))
      c.push(parseExpression(tagged.quasi.expressions[i]!, true)!);
    return c;
  }, []);

  const descriptorId = descriptor
    ? findPropertyValueIfStringLiteralAsString(descriptor, 'id')
    : undefined;
  const descriptorContext = descriptor
    ? findPropertyValueIfStringLiteralAsString(descriptor, 'context')
    : undefined;

  return new CompositeMessage(
    { id: descriptorId, context: descriptorContext },
    getTranslatorComments(tagged.leadingComments ?? []),
    tagged.loc ? [`${tagged.loc.filename}:${tagged.loc.start.line}`] : [],
    children,
    accessor,
  );
}

export function parseCallExpression(call: t.CallExpression): CompositeMessage | null {
  const processed = processExpression(call.callee);
  if (!processed) return null;
  const [accessor, descriptor, kind] = processed;

  if (typeof kind === 'string' && ['select', 'ordinal', 'plural'].includes(kind)) {
    if (call.arguments.length !== 2) return null;
    if (!t.isExpression(call.arguments[0])) return null;
    if (!t.isObjectExpression(call.arguments[1])) return null;
    const object = call.arguments[1];

    const branches = object.properties.reduce<ChoiceMessage['branches']>((c, p) => {
      if (!t.isObjectProperty(p) || !t.isExpression(p.value)) return c;

      let message: Message | null = null;
      if (!message && t.isStringLiteral(p.value)) message = new LiteralMessage(p.value.value);
      if (!message) message = parseExpression(p.value, true);
      c.push({
        identifier: getPropertyNameAsString(p.key),
        value: message!,
      });

      return c;
    }, []);

    const value = call.arguments[0];
    const identifier = getExpressionAsKey(value);
    const choice = new ChoiceMessage(kind, identifier, branches, value);

    const descriptorId = descriptor
      ? findPropertyValueIfStringLiteralAsString(descriptor, 'id')
      : undefined;
    const descriptorContext = descriptor
      ? findPropertyValueIfStringLiteralAsString(descriptor, 'context')
      : undefined;

    return new CompositeMessage(
      { id: descriptorId, context: descriptorContext },
      [],
      call.loc ? [`${call.loc.filename}:${call.loc.start.line}`] : [],
      [choice],
      accessor,
    );
  }

  return null;
}

//

export function processExpression(
  expression: t.Node,
): [t.Expression, t.ObjectExpression | null, string | null] | null {
  if (t.isIdentifier(expression) && expression.name === 'say') {
    return [expression, null, null];
  }

  if (t.isCallExpression(expression)) {
    const inner = processExpression(expression.callee);

    if (
      inner &&
      expression.arguments.length === 1 &&
      t.isObjectExpression(expression.arguments[0])
    ) {
      return [inner[0], expression.arguments[0], null];
    } else if (inner) {
      return [inner[0], null, null];
    }
  }

  if (t.isMemberExpression(expression)) {
    const innerProperty = processExpression(expression.property);
    if (innerProperty) return [expression, innerProperty[1], null];
    const innerObject = processExpression(expression.object);
    if (innerObject && t.isIdentifier(expression.property))
      return [innerObject[0], innerObject[1], expression.property.name];
  }

  return null;
}

function getExpressionAsKey(node: t.Node) {
  if (t.isIdentifier(node)) return node.name;
  if (t.isJSXIdentifier(node)) return node.name;
  return AUTO_INCREMENT_IDENTIFIER;
}

export function parseExpression(
  expression: t.Expression,
  fallback?: false,
): CompositeMessage | null;
export function parseExpression(
  expression: t.Expression,
  fallback: true,
): CompositeMessage | ArgumentMessage;
export function parseExpression(expression: t.Expression, fallback?: boolean) {
  let message: CompositeMessage | null = null;
  switch (true) {
    case t.isTaggedTemplateExpression(expression):
      message = parseTaggedTemplateExpression(expression);
      break;
    case t.isCallExpression(expression):
      message = parseCallExpression(expression);
      break;
  }

  if (message) {
    return message;
  } else if (fallback) {
    const key = getExpressionAsKey(expression);
    return new ArgumentMessage(key as string, expression);
  } else {
    return null;
  }
}

//

function getPropertyNameAsString(key: t.ObjectProperty['key']) {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  if (t.isNumericLiteral(key)) return key.value.toString();
  if (t.isBigIntLiteral(key)) return key.value.toString();
  return AUTO_INCREMENT_IDENTIFIER;
}

function findPropertyValueIfStringLiteralAsString(object: t.ObjectExpression, key: string) {
  for (const property of object.properties) {
    if (!t.isObjectProperty(property)) continue;
    if (
      t.isIdentifier(property.key) &&
      property.key.name === key &&
      t.isStringLiteral(property.value)
    )
      return property.value.value;
  }
  return undefined;
}

function getTranslatorComments(comments: t.Comment[]) {
  return comments.reduce<string[]>((a, c) => {
    const text = c.value.trim();
    if (text.toLowerCase().startsWith('translators:')) a.push(text.slice(12).trim());
    return a;
  }, []);
}
