import * as t from '@babel/types';
import type { CompositeMessage } from '~/core/messages/types.js';
import { generateChildExpressions } from '../js/generator.js';

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
