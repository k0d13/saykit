import { type Message, messageKey, type Transformer } from '@saykit/config';

export function createEmailTransformer(): Transformer {
  return {
    match(id) {
      return id.endsWith('.email');
    },

    extract(code, id) {
      const message = parseTemplate(code, id);
      return message ? [message] : [];
    },

    transform(code, id) {
      const message = parseTemplate(code, id);

      if (!message) return 'export default () => "";\n';

      const key = messageKey(message);

      return [
        `// generated from ${id} by the .email transformer`,
        `export default function render(say, values = {}) {`,
        `  return say.call({ id: ${JSON.stringify(key)}, ...values });`,
        `}`,
        '',
      ].join('\n');
    },
  };
}

function parseTemplate(code: string, id: string): Message | null {
  const comments: string[] = [];
  const body: string[] = [];

  for (const line of code.split(/\r?\n/)) {
    if (body.length === 0 && line.startsWith('#')) {
      comments.push(line.slice(1).trim());
    } else {
      body.push(line);
    }
  }

  const message = body.join('\n').trim();
  if (!message) return null;

  return {
    message,
    translation: undefined,
    id: undefined,
    context: undefined,
    comments,
    references: [id],
  };
}

export default createEmailTransformer;
