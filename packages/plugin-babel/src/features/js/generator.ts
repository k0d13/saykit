import * as t from '@babel/types';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  type Message,
} from '~/core/messages/types.js';

export function generateSayCallExpression(message: CompositeMessage) {
  const id = message.descriptor.id ?? message.toHashString();
  const children = generateChildExpressions(message.children);

  const properties = t.objectExpression([
    t.objectProperty(t.identifier('id'), t.stringLiteral(id)),
    ...children.map(([key, expr]) => t.objectProperty(t.identifier(key), expr)),
  ]);

  return t.callExpression(t.memberExpression(message.accessor, t.identifier('call')), [properties]);
}

export function generateChildExpressions(messages: Message[]) {
  return messages.reduce<[string, t.Expression][]>((c, m) => {
    if (m instanceof ArgumentMessage) {
      c.push([m.identifier, m.expression]);
    }

    if (m instanceof ElementMessage) {
      c.push([m.identifier, m.expression]);
      c.push(...generateChildExpressions(m.children));
    }

    if (m instanceof ChoiceMessage) {
      c.push([m.identifier, m.expression]);
      c.push(...generateChildExpressions(m.branches.map((b) => b.value)));
    }

    if (m instanceof CompositeMessage) {
      c.push(...generateChildExpressions(m.children));
    }

    return c;
  }, []);
}
