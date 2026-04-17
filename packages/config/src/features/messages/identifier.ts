import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  type Message,
} from './types.js';

export const AUTO_INCREMENT_IDENTIFIER = Symbol('auto-increment');

export function assignSequenceIdentifiers(message: Message, sequence = { current: 0 }) {
  if (
    message instanceof ArgumentMessage ||
    message instanceof ElementMessage ||
    message instanceof ChoiceMessage
  )
    if (message.identifier === AUTO_INCREMENT_IDENTIFIER)
      message.identifier = `${sequence.current++}`;
  if (message instanceof CompositeMessage || message instanceof ElementMessage)
    for (const child of message.children) assignSequenceIdentifiers(child, sequence);
  if (message instanceof ChoiceMessage)
    for (const branch of message.branches) {
      if (branch.identifier === AUTO_INCREMENT_IDENTIFIER)
        branch.identifier = `${sequence.current++}`;
      assignSequenceIdentifiers(branch.value, sequence);
    }
}
