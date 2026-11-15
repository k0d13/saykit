import { escapeIcuLiteral } from './escape.js';
import { getBranchCase } from './identifier.js';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  LiteralMessage,
  type Message,
} from './types.js';

/**
 * What `#` means at the point in the message being converted.
 *
 * `undefined` is outside any `plural` or `ordinal`, where `#` is an ordinary
 * character. Inside one it names the selector `#` stands for, which is both the
 * argument that may be written as `#` and the signal that a literal `#` has to
 * be escaped. A `select` nested inside a plural inherits it, `#` reaches
 * through, while a nested plural replaces it with its own selector.
 */
type HashScope = string | undefined;

export function convertMessageToIcu(message: Message) {
  function internalConvertMessageToIcu(message: Message, hash: HashScope): string {
    switch (true) {
      case message instanceof LiteralMessage:
        return escapeIcuLiteral(String(message.text), hash !== undefined);

      case message instanceof ArgumentMessage: {
        // The selector of the plural this sits in, written as the plural's own
        // `#`. The two are the same value and the same prop, and `#` is the
        // spelling a translator expects to move around the sentence. An
        // argument that formats itself is not interchangeable with it
        if (!message.format && hash !== undefined && String(message.identifier) === hash)
          return '#';

        const parts = [String(message.identifier)];
        if (message.format) parts.push(message.format.type);
        if (message.format?.style) parts.push(message.format.style);
        return `{${parts.join(', ')}}`;
      }

      case message instanceof ElementMessage: {
        // A childless element is self-closing, so a translator has nowhere to
        // insert content that the element never expected. This tracks the
        // source: an element written as a pair stays a pair, even when its
        // children happen to render to nothing
        if (message.children.length === 0) return `<${String(message.identifier)}/>`;
        const children = message.children.map((m) => internalConvertMessageToIcu(m, hash)).join('');
        return `<${String(message.identifier)}>${children}</${String(message.identifier)}>`;
      }

      case message instanceof ChoiceMessage: {
        const scope = message.kind === 'select' ? hash : String(message.identifier);
        const branches = message.branches
          .map(({ identifier, value }) => ({
            identifier: getBranchCase(message.kind, identifier),
            value: internalConvertMessageToIcu(value, scope),
          }))
          .map(({ identifier, value }) => `  ${identifier} {${value}}\n`)
          .join('');
        const format = message.kind === 'ordinal' ? 'selectordinal' : message.kind;
        // `select` matches its cases as literal strings and has no number to
        // offset, so an offset there would be invalid ICU rather than a no-op
        const offset =
          message.offset === undefined || message.kind === 'select'
            ? ''
            : ` offset:${message.offset}`;
        return `{${String(message.identifier)}, ${format},${offset}\n${branches}}`;
      }

      case message instanceof CompositeMessage:
        return Object.entries(message.children)
          .map(([, m]) => internalConvertMessageToIcu(m, hash))
          .join('');

      default:
        throw new Error('Unknown message type', { cause: message });
    }
  }

  return internalConvertMessageToIcu(message, undefined).trim();
}
