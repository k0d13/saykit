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
        return `{${message.identifier}}`;

      case message instanceof ElementMessage: {
        const children = message.children.map((m) => internalConvertMessageToIcu(m)).join('');
        return `<${message.identifier}>${children}</${message.identifier}>`;
      }

      case message instanceof ChoiceMessage: {
        const branches = message.branches
          .map(({ key, value }) => ({
            key: Number.isNaN(+key) ? key : `=${+key}`,
            value: internalConvertMessageToIcu(value),
          }))
          .map(({ key, value }) => `  ${key} {${value}}\n`)
          .join('');
        const format = message.kind === 'ordinal' ? 'selectordinal' : message.kind;
        return `{${message.identifier}, ${format},\n${branches}}`;
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
