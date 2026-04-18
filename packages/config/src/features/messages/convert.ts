import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  LiteralMessage,
  type Message,
} from './types.js';

export function convertMessageToIcu(message: Message) {
  function internalConvertMessageToIcu(message: Message): string {
    switch (true) {
      case message instanceof LiteralMessage:
        return String(message.text);

      case message instanceof ArgumentMessage:
        return `{${String(message.identifier)}}`;

      case message instanceof ElementMessage: {
        const children = message.children.map((m) => internalConvertMessageToIcu(m)).join('');
        return `<${String(message.identifier)}>${children}</${String(message.identifier)}>`;
      }

      case message instanceof ChoiceMessage: {
        const branches = message.branches
          .map(({ identifier, value }) => ({
            identifier: Number.isNaN(+String(identifier))
              ? String(identifier)
              : `=${+String(identifier)}`,
            value: internalConvertMessageToIcu(value),
          }))
          .map(({ identifier, value }) => `  ${identifier} {${value}}\n`)
          .join('');
        const format = message.kind === 'ordinal' ? 'selectordinal' : message.kind;
        return `{${String(message.identifier)}, ${format},\n${branches}}`;
      }

      case message instanceof CompositeMessage:
        return Object.entries(message.children)
          .map(([, m]) => internalConvertMessageToIcu(m))
          .join('');

      default:
        throw new Error('Unknown message type', { cause: message });
    }
  }

  return internalConvertMessageToIcu(message).trim();
}
