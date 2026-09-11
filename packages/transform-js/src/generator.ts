import * as t from '@babel/types';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  type Message,
} from '@saykit/config/features/messages';

/**
 * Whether a message is one formatted value and nothing else: `say.date(x)` on
 * its own rather than inside a sentence. The style and the locale already
 * decide what it renders as, so there is nothing in it for a translator to
 * change: it is never extracted, and the call carries the message itself
 * rather than an id to look one up by.
 */
export function isLoneArgument(message: CompositeMessage) {
  const [child] = message.children;
  return message.children.length === 1 && child instanceof ArgumentMessage && !!child.format;
}

/**
 * The property a call looks its message up by: an id into the catalogue, or
 * the ICU message itself when nothing was extracted.
 */
export function generateDescriptorProperty(message: CompositeMessage) {
  if (isLoneArgument(message))
    return t.objectProperty(t.identifier('message'), t.stringLiteral(message.toICUString()));
  const id = message.descriptor.id ?? message.toHashString();
  return t.objectProperty(t.identifier('id'), t.stringLiteral(id));
}

export function generateSayCallExpression(message: CompositeMessage) {
  const children = generateChildExpressions(message.children);

  const properties = t.objectExpression([
    generateDescriptorProperty(message),
    // An identifier can repeat, the same argument interpolated twice, but it
    // is one property either way.
    //
    // Every value is emitted behind an underscore, which both makes a numbered
    // identifier a valid property name and keeps the message's values out of
    // the descriptor's own namespace: an argument named `id` no longer
    // displaces the message being looked up. The runtime strips exactly one
    // underscore back off
    ...[...new Map(children).entries()].map(([ident, expr]) =>
      t.objectProperty(t.identifier(`_${ident}`), expr),
    ),
  ]);

  return t.callExpression(t.memberExpression(message.accessor, t.identifier('call')), [properties]);
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
