import { type Formatter, type Message, messageKey } from '@saykit/config';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

interface Entry {
  source?: string;
  translation?: string;
  context?: string;
  comments?: string[];
  references?: string[];
}

interface Catalogue {
  locale?: string;
  messages?: Record<string, Entry>;
}

export interface YamlFormatterOptions {
  includeReferences?: boolean;
}

export function createYamlFormatter(options: YamlFormatterOptions = {}): Formatter {
  const { includeReferences = true } = options;

  return {
    extension: '.yml',

    parse(content) {
      const data = (parseYaml(content) ?? {}) as Catalogue;
      const messages: Message[] = [];

      for (const [id, entry] of Object.entries(data.messages ?? {})) {
        messages.push({
          id,
          message: entry.source ?? '',
          translation: entry.translation || undefined,
          context: entry.context,
          comments: entry.comments ?? [],
          references: entry.references ?? [],
        });
      }

      return messages;
    },

    stringify(messages, { locale, existingContent }) {
      const previous = (existingContent ? parseYaml(existingContent) : null) as Catalogue | null;

      const entries: Record<string, Entry> = {};

      for (const message of [...messages].sort((a, b) =>
        messageKey(a).localeCompare(messageKey(b)),
      )) {
        const id = messageKey(message);
        const entry: Entry = { source: message.message };

        entry.translation = message.translation ?? previous?.messages?.[id]?.translation ?? '';

        if (message.context) entry.context = message.context;
        if (message.comments.length) entry.comments = message.comments;
        if (includeReferences && message.references.length) entry.references = message.references;

        entries[id] = entry;
      }

      return stringifyYaml({ ...previous, locale, messages: entries }, { lineWidth: 0 });
    },
  };
}

export default createYamlFormatter;
