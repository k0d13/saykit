import { type Formatter, type Message, messageKey } from '@saykit/config';

type Dialect = 'arb' | 'webextension';

interface FormatterOptions {
  /**
   * The JSON dialect to write. A dialect other than the default plain
   * `{ key: value }` map carries message metadata (comments, context, source
   * references) using a richer, but still standard, layout.
   *
   * - `'arb'`: Application Resource Bundle (Flutter/Dart `intl`). Strings stay
   *   flat and each key's metadata lives in a sibling `@key` object.
   * - `'webextension'`: the Chrome/WebExtension `messages.json` shape, where
   *   each key maps to a `{ message, description }` object.
   *
   * Both carry translator comments in their native `description` field. Context
   * and source references have no standard slot, so they round-trip through
   * `x-saykit-context` / `x-saykit-references` extension fields that other
   * tooling safely ignores. Omit for a plain flat catalogue, which carries no
   * metadata.
   */
  dialect?: Dialect;

  /**
   * Include source references in the generated catalogue. Only the metadata
   * carrying dialects have anywhere to put them, so this has no effect on the
   * plain layout.
   * @default true
   */
  includeReferences?: boolean;

  /**
   * Include line numbers in source references.
   * @default true
   */
  includeLineNumbers?: boolean;
}

const CONTEXT_FIELD = 'x-saykit-context';
const REFERENCES_FIELD = 'x-saykit-references';

type Attributes = Record<string, unknown>;

function isRecord(value: unknown): value is Attributes {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Build the metadata attributes shared by the ARB and WebExtension layouts. */
function toAttributes(message: Message, options: FormatterOptions): Attributes {
  const attributes: Attributes = {};
  if (message.comments.length) attributes.description = message.comments.join('\n');
  if (message.context) attributes[CONTEXT_FIELD] = message.context;

  if (options.includeReferences !== false) {
    let references = message.references ?? [];
    if (options.includeLineNumbers === false)
      references = references.map((r) => r.replace(/:\d+$/, ''));
    references = Array.from(new Set(references)).sort();
    if (references.length) attributes[REFERENCES_FIELD] = references;
  }

  return attributes;
}

/** Reconstruct a {@link Message} from a key, its value, and optional metadata. */
function toMessage(key: string, value: string, attributes?: Attributes): Message {
  const description =
    attributes && typeof attributes.description === 'string' ? attributes.description : '';
  const context =
    attributes && typeof attributes[CONTEXT_FIELD] === 'string'
      ? (attributes[CONTEXT_FIELD] as string)
      : undefined;
  const references =
    attributes && Array.isArray(attributes[REFERENCES_FIELD])
      ? (attributes[REFERENCES_FIELD] as unknown[]).filter(
          (r): r is string => typeof r === 'string',
        )
      : [];

  return {
    id: key,
    message: value,
    translation: value,
    context,
    comments: description ? description.split('\n') : [],
    references,
  };
}

function createJsonFormatter(options: FormatterOptions = {}): Formatter {
  return {
    extension: '.json',

    parse(content) {
      const data = JSON.parse(content) as Record<string, unknown>;

      if (options.dialect === 'arb') {
        return Object.entries(data)
          .filter(([key, value]) => !key.startsWith('@') && typeof value === 'string')
          .map(([key, value]) =>
            toMessage(key, value as string, data[`@${key}`] as Attributes | undefined),
          );
      }

      if (options.dialect === 'webextension') {
        return Object.entries(data)
          .filter(([, value]) => isRecord(value) && typeof value.message === 'string')
          .map(([key, value]) => {
            const entry = value as Attributes;
            return toMessage(key, entry.message as string, entry);
          });
      }

      return Object.entries(data)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => toMessage(key, value as string));
    },

    stringify(messages, { locale }) {
      const sorted = [...messages].sort((a, b) => messageKey(a).localeCompare(messageKey(b)));

      if (options.dialect === 'arb') {
        const catalogue: Record<string, unknown> = { '@@locale': locale };
        for (const message of sorted) {
          const key = messageKey(message);
          catalogue[key] = message.translation ?? '';
          const attributes = toAttributes(message, options);
          if (Object.keys(attributes).length) catalogue[`@${key}`] = attributes;
        }
        return `${JSON.stringify(catalogue, null, 2)}\n`;
      }

      if (options.dialect === 'webextension') {
        const catalogue: Record<string, unknown> = {};
        for (const message of sorted) {
          catalogue[messageKey(message)] = {
            message: message.translation ?? '',
            ...toAttributes(message, options),
          };
        }
        return `${JSON.stringify(catalogue, null, 2)}\n`;
      }

      const catalogue: Record<string, string> = {};
      for (const message of sorted) {
        catalogue[messageKey(message)] = message.translation ?? '';
      }
      return `${JSON.stringify(catalogue, null, 2)}\n`;
    },
  };
}

export type { FormatterOptions, Dialect };
export default createJsonFormatter;
