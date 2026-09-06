import { datetime, duration, number, plural } from './runtime.js';

/**
 * A compiled message.
 *
 * The CLI compiles a catalogue's messages down to this: arrays and strings,
 * with every style already resolved to the options bag it stands for. Nothing
 * here is parsed at runtime, and nothing here is a function, so a locale's
 * messages are data - they cross a server/client boundary the way any other
 * JSON does, which a compiled function cannot.
 *
 * A message with no placeholders is its own string, so the common case costs
 * nothing at all.
 */
export type Message =
  // Literal text, or a literal number a branch compares against
  | string
  | number
  // Concatenation: the parts of one message, in order
  | ['c', ...Message[]]
  // A value from the descriptor, by key
  | ['v', string]
  // A runtime helper over one value, with the options it was compiled with
  | ['f', Message.Helper, Message, unknown?]
  // A conditional: test, then, else
  | ['?', Message, Message, Message]
  // Equality between two nodes
  | ['=', Message, Message]
  // Subtraction, for a plural offset
  | ['-', Message, Message]
  // Multiplication, for a number scale
  | ['*', Message, Message]
  // String coercion, for a select matching its cases as text
  | ['s', Message];

export namespace Message {
  /** The helpers a compiled message may call. */
  export type Helper = 'number' | 'datetime' | 'duration' | 'plural';

  /** What a compiled message is called with: the descriptor the transform built. */
  export type Values = Record<string, unknown>;
}

/**
 * The helpers, by the name a message calls them under.
 *
 * Uniform on purpose: every one takes the locale, the value, and whatever
 * options it was compiled with, so `'f'` is one call shape rather than four.
 */
const HELPERS: Record<Message.Helper, (locale: string, value: never, options: never) => unknown> = {
  number: number as never,
  datetime: datetime as never,
  plural: plural as never,
  // The one helper with nothing locale-dependent about it
  duration: ((_locale: string, value: number) => duration(value)) as never,
};

type Formatter = (values: Message.Values) => unknown;

/** Whether, and how, a written value is wrapped in bidi isolation marks. */
type Isolate = (helper: Message.Helper | undefined, written: unknown) => unknown;

// First strong, left-to-right and right-to-left isolates, and the pop that ends each
const FSI = '⁨';
const LRI = '⁦';
const RLI = '⁧';
const PDI = '⁩';

// Scripts written right to left, from CLDR's script metadata
const RTL = new Set(['Adlm', 'Arab', 'Hebr', 'Mand', 'Nkoo', 'Rohg', 'Syrc', 'Thaa']);

function localeDir(locale: string): 'ltr' | 'rtl' | 'auto' {
  try {
    const script = new Intl.Locale(locale).maximize().script;
    if (script) return RTL.has(script) ? 'rtl' : 'ltr';
  } catch {
    // An unknown locale has no direction to go on
  }
  return 'auto';
}

/**
 * The isolation MessageFormat 2 applies by default.
 *
 * A number or a date is written in the locale's own direction, so in a
 * left-to-right message it needs nothing and otherwise takes that direction's
 * isolate. Anything else could be in any script, so it is isolated by its
 * first strong character.
 */
function isolation(locale: string): Isolate {
  const dir = localeDir(locale);
  const own = dir === 'ltr' ? LRI : dir === 'rtl' ? RLI : FSI;
  return (helper, written) => {
    // A plural category is only ever selected on, never shown
    if (written === undefined || helper === 'plural') return written;
    if (helper === 'number' || helper === 'datetime')
      return dir === 'ltr' ? written : own + String(written) + PDI;
    return FSI + String(written) + PDI;
  };
}

/**
 * Build the closure one node evaluates to.
 *
 * The walk happens once per message, and every branch of it resolves what it
 * can while it walks: a helper is looked up here rather than per call, and so
 * are a conditional's arms. What is left at call time is the work that depends
 * on the values.
 *
 * `isolate` is set only where a node's result is written into the message,
 * rather than compared, selected on or computed with.
 */
function build(node: Message, locale: string, isolate?: Isolate): Formatter {
  if (!Array.isArray(node)) return () => node;

  switch (node[0]) {
    case 'c': {
      const parts = node.slice(1).map((part) => build(part as Message, locale, isolate));
      return (values) => {
        let written = '';
        for (const part of parts) written += part(values) ?? '';
        return written;
      };
    }

    case 'v': {
      const key = node[1];
      if (isolate) return (values) => isolate(undefined, values[key]);
      return (values) => values[key];
    }

    case 'f': {
      const name = node[1];
      const helper = HELPERS[name];
      const value = build(node[2], locale);
      const options = node[3];
      if (isolate)
        return (values) => isolate(name, helper(locale, value(values) as never, options as never));
      return (values) => helper(locale, value(values) as never, options as never);
    }

    case '?': {
      const test = build(node[1], locale);
      const then = build(node[2], locale, isolate);
      const otherwise = build(node[3], locale, isolate);
      return (values) => (test(values) ? then(values) : otherwise(values));
    }

    case '=': {
      const left = build(node[1], locale);
      const right = build(node[2], locale);
      return (values) => left(values) === right(values);
    }

    case '-': {
      const left = build(node[1], locale);
      const right = build(node[2], locale);
      return (values) => (left(values) as number) - (right(values) as number);
    }

    case '*': {
      const left = build(node[1], locale);
      const right = build(node[2], locale);
      return (values) => (left(values) as number) * (right(values) as number);
    }

    default: {
      const value = build(node[1], locale);
      if (isolate) return (values) => isolate(undefined, String(value(values)));
      return (values) => String(value(values));
    }
  }
}

/**
 * Compile one message into the function that formats it.
 *
 * Called once per message per locale: a view memoises what this returns, so a
 * message walked here is called from the closure afterwards.
 *
 * @param message The compiled message, as the CLI emitted it
 * @param locale The locale to bind its helpers to
 * @param options Whether written values are wrapped in bidi isolation marks
 * @returns A function from a descriptor to the formatted string
 */
export function compileMessage(
  message: Message,
  locale: string,
  options: { bidiIsolation?: 'default' | 'none' } = {},
): (values: Message.Values) => string {
  // A message with no placeholders is already its own answer
  if (typeof message === 'string') return () => message;

  const isolate = options.bidiIsolation === 'none' ? undefined : isolation(locale);
  const formatter = build(message, locale, isolate);
  return (values) => String(formatter(values) ?? '');
}
