import { generate } from '@babel/generator';
import * as parser from '@babel/parser';
import traverse_ from '@babel/traverse';
import type { Transformer } from '@saykit/config';
import { assignSequenceIdentifiers, CompositeMessage } from '@saykit/config/features/messages';
import { generateSayCallExpression } from './generator.js';
import { parseExpression } from './parser.js';

const traverse = ((traverse_ as any).default || traverse_) as typeof traverse_;

function createProgram(code: string, id: string) {
  const program = parser.parse(code, {
    sourceType: 'module',
    sourceFilename: id,
    plugins: ['typescript'],
    allowImportExportEverywhere: false,
    allowReturnOutsideFunction: true,
    ranges: true,
    attachComment: true,
    tokens: true,
  });

  return Object.assign(program, {
    toString() {
      return generate(program, {
        retainLines: true,
        comments: true,
        compact: false,
      }).code;
    },
  });
}

function createJsTransformer(): Transformer {
  return {
    match(id: string) {
      return ['.js', '.cjs', '.mjs', '.ts', '.mts', '.cts'].some((e) => id.endsWith(e));
    },

    extract(code: string, id: string) {
      const program = createProgram(code, id);
      const messages: CompositeMessage[] = [];

      traverse(program, {
        Expression(path) {
          path.node.leadingComments = path.node.leadingComments ?? [];
          const message = parseExpression(path.node);
          if (message) {
            assignSequenceIdentifiers(message, { current: 0 });
            messages.push(message);
            path.skip();
          }
        },
      });

      // TODO: Can this just return the messages themselves, and be converted upstream
      return messages.map((message) => ({
        message: message.toICUString(),
        translation: undefined,
        id: message.descriptor.id,
        context: message.descriptor.context,
        comments: message.comments,
        references: message.references,
      }));
    },

    transform(code: string, id: string) {
      const program = createProgram(code, id);

      traverse(program, {
        Expression(path) {
          path.node.leadingComments = path.node.leadingComments ?? [];
          const message = parseExpression(path.node);
          if (message) {
            assignSequenceIdentifiers(message, { current: 0 });
            const replacement = generateSayCallExpression(message);
            path.replaceWith(replacement);
            path.skip();
          }
        },
      });

      return program.toString();
    },
  };
}

export default createJsTransformer;
