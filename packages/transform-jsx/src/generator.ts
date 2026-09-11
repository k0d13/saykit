import * as t from '@babel/types';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  type Message,
} from '@saykit/config/features/messages';
import { generateDescriptorProperty } from '@saykit/transform-js/generator';

export function generateSayJSXElement(message: CompositeMessage) {
  const children = generateChildExpressions(message.children);

  // The same lookup a call makes, written as a prop: an id, or the message
  // itself when there was nothing to extract
  const descriptor = generateDescriptorProperty(message);
  const attributes = [
    t.jsxAttribute(
      t.jsxIdentifier((descriptor.key as t.Identifier).name),
      descriptor.value as t.StringLiteral,
    ),
    ...(message.whitespace === undefined
      ? []
      : [
          t.jsxAttribute(
            t.jsxIdentifier('whitespace'),
            t.jsxExpressionContainer(t.booleanLiteral(message.whitespace)),
          ),
        ]),
    // An identifier can repeat, the same argument interpolated twice, or two
    // identical elements sharing a tag, but it is one prop either way.
    //
    // Every value is emitted behind an underscore, which makes numbered
    // identifiers valid prop names and keeps them out of `Say`'s own namespace,
    // so no name a message chooses collides with `id`, `whitespace`, `key` or
    // `ref`. The runtime strips exactly one underscore back off
    ...[...new Map(children).entries()].map(([k, e]) =>
      t.jsxAttribute(t.jsxIdentifier(`_${k}`), t.jsxExpressionContainer(e)),
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
