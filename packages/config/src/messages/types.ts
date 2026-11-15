import { convertMessageToIcu } from './convert.js';
import { generateHash } from './hash.js';
import { AUTO_INCREMENT_IDENTIFIER } from './identifier.js';
import type { ArgumentType } from './styles.js';

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

/**
 * An ICU argument type and style, e.g. `{n, number, percent}`. A style is
 * optional: `{n, number}` is the type's default formatting.
 *
 * Both are kept as the ICU strings they are written as, rather than as `Intl`
 * options, because the catalogue is the source of truth and only the ICU
 * spelling round-trips back out of it.
 */
export interface ArgumentFormat {
  type: ArgumentType;
  style?: string;
}

export class ArgumentMessage extends Base {
  constructor(
    public identifier: string | typeof AUTO_INCREMENT_IDENTIFIER,
    public readonly expression: any,
    public readonly format?: ArgumentFormat,
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
    /**
     * Subtracted from the selector before `#` is formatted, so "You and 2
     * others" can select on a total of three. Only `plural` and `ordinal`
     * accept one; `select` has no number to offset.
     */
    public readonly offset?: number,
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
    public readonly whitespace?: boolean,
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
