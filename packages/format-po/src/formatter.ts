import type { Formatter } from '@saykit/config';
import PO from 'pofile';

interface FormatterOptions {
  /**
   * Include source references in the generated PO file.
   * @default true
   */
  includeReferences?: boolean;

  /**
   * Include line numbers in source references.
   * @default true
   */
  includeLineNumbers?: boolean;

  /**
   * Flags written on every message entry (not the header), such as
   * `icu-message-format` for Weblate. Flags already on an entry in the
   * existing file are kept.
   * @default []
   */
  flags?: string[];
}

// Entries with an explicit id are distinct even when their text and context match
const entryKey = (id: string | undefined, context: string | undefined, message: string) =>
  id ? JSON.stringify(['id', id]) : JSON.stringify(['text', context ?? '', message]);
const readId = (item: { extractedComments: string[] }) =>
  item.extractedComments.find((c) => c.startsWith('id:'))?.slice(3);

function createPoFormatter(options: FormatterOptions = {}): Formatter {
  return {
    extension: '.po',

    parse(content) {
      const po = PO.parse(content);

      return po.items.map((item) => {
        const id = readId(item);
        const comments = item.extractedComments //
          .filter((c) => !c.startsWith('id:'))
          .map((c) => c.trim());

        return {
          id,
          context: item.msgctxt,
          message: item.msgid,
          translation: item.msgstr[0],
          comments,
          references: item.references,
          flags: Object.keys(item.flags).filter((f) => item.flags[f]),
        };
      });
    },

    stringify(messages, { locale, existingContent }) {
      const po = new PO();
      const existingFlags = new Map<string, string[]>();
      if (existingContent) {
        const existing = PO.parse(existingContent);
        Object.assign(po.headers, existing.headers);
        for (const item of existing.items) {
          const flags = Object.keys(item.flags).filter((f) => item.flags[f]);
          if (flags.length)
            existingFlags.set(entryKey(readId(item), item.msgctxt, item.msgid), flags);
        }
      }

      po.headers['Content-Type'] ||= 'text/plain; charset=UTF-8';
      po.headers['Content-Transfer-Encoding'] ||= '8bit';
      po.headers['Language'] ||= locale;
      po.headers['X-Generator'] ||= 'saykit';

      for (const message of messages.sort((a, b) => a.message.localeCompare(b.message))) {
        const item = new PO.Item();

        item.msgid = message.message;
        if (message.context) item.msgctxt = message.context;
        item.msgstr = [message.translation ?? ''];

        const comments = [];
        if (message.id) comments.push(`id:${message.id}`);
        if (message.comments.length) comments.push(...message.comments);
        item.extractedComments = comments;

        if (options.includeReferences !== false) {
          let references = message.references ?? [];
          if (options.includeLineNumbers === false)
            references = references.map((r) => r.replace(/:\d+$/, ''));
          item.references = Array.from(new Set(references)).sort();
        }
        const flags = [
          ...(existingFlags.get(entryKey(message.id, message.context, message.message)) ?? []),
          ...(message.flags ?? []),
          ...(options.flags ?? []),
        ];
        for (const flag of flags) if (flag.trim()) item.flags[flag.trim()] = true;

        po.items.push(item);
      }

      return po.toString();
    },
  };
}

export type { FormatterOptions };
export default createPoFormatter;
