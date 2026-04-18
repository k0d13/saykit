import * as t from '@babel/types';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  type Message,
} from '@saykit/config/features/messages';

export function generateSayJSXElement(message: CompositeMessage) {
  const id = message.descriptor.id ?? message.toHashString();
  const children = generateChildExpressions(message.children);

  const attributes = [
    t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral(id)),
    ...children.map(([k, e]) =>
      t.jsxAttribute(t.jsxIdentifier(Number.isNaN(+k) ? k : `_${k}`), t.jsxExpressionContainer(e)),
    ),
  ];

  return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('Say'), attributes, true), null, []);
}

function generateChildExpressions(messages: Message[]) {
  return messages.reduce<[string, t.Expression][]>((c, m) => {
    if (m instanceof ArgumentMessage) {
      c.push([String(m.identifier), m.expression]);
    }

    if (m instanceof ElementMessage) {
      c.push([String(m.identifier), m.expression]);
      c.push(...generateChildExpressions(m.children));
    }

    if (m instanceof ChoiceMessage) {
      c.push([String(m.identifier), m.expression]);
      c.push(...generateChildExpressions(m.branches.map((b) => b.value)));
    }

    if (m instanceof CompositeMessage) {
      c.push(...generateChildExpressions(m.children));
    }

    return c;
  }, []);
}
