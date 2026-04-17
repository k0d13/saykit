import { convertMessageToIcu } from './convert.js';
import { generateHash } from './hash.js';
import { AUTO_INCREMENT_IDENTIFIER } from './identifier.js';

abstract class Base {
  toICUString(this: Message) {
    return convertMessageToIcu(this);
  }

  toHashString(this: Message) {
    const context = this instanceof CompositeMessage ? this.descriptor.context : undefined;
    return generateHash(this.toICUString(), context);
  }
}

export class LiteralMessage extends Base {
  constructor(public readonly text: string) {
    super();
  }
}

export class ArgumentMessage extends Base {
  constructor(
    public identifier: string | typeof AUTO_INCREMENT_IDENTIFIER,
    public readonly expression: any,
  ) {
    super();
  }
}

export class ElementMessage extends Base {
  constructor(
    public identifier: string | typeof AUTO_INCREMENT_IDENTIFIER,
    public readonly children: Message[],
    public readonly expression: any,
  ) {
    super();
  }
}

export class ChoiceMessage extends Base {
  constructor(
    public readonly kind: string,
    public identifier: string | typeof AUTO_INCREMENT_IDENTIFIER,
    public readonly branches: {
      identifier: string | typeof AUTO_INCREMENT_IDENTIFIER;
      readonly value: Message;
    }[],
    public readonly expression: any,
  ) {
    super();
  }
}

export class CompositeMessage extends Base {
  constructor(
    public readonly descriptor: { id?: string; context?: string },
    public readonly comments: string[],
    public readonly references: string[],
    public readonly children: Message[],
    public readonly accessor: any,
  ) {
    super();
  }
}

export type Message =
  | LiteralMessage
  | ArgumentMessage
  | ElementMessage
  | ChoiceMessage
  | CompositeMessage;
