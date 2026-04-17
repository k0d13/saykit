import { generate } from '@babel/generator';
import * as parser from '@babel/parser';
import traverse_ from '@babel/traverse';
import type { Transformer } from '@saykit/config';
import { assignSequenceIdentifiers, CompositeMessage } from '@saykit/config/features/messages';
import { generateSayCallExpression } from '@saykit/transform-js/generator';
import { parseExpression } from '@saykit/transform-js/parser';
import { generateSayJSXElement } from './generator.js';
import { parseJSXElement } from './parser.js';

const traverse = ((traverse_ as any).default || traverse_) as typeof traverse_;

function createProgram(id: string, content: string) {
  const program = parser.parse(content, {
    sourceType: 'module',
    sourceFilename: id,
    plugins: ['typescript', 'jsx'],
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

function createJsxTransformer(): Transformer {
  return {
    match(id: string) {
      return ['.jsx', '.tsx'].some((e) => id.endsWith(e));
    },

    extract(id: string, content: string) {
      const program = createProgram(id, content);
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

        JSXElement(path) {
          path.node.leadingComments = path.node.leadingComments ?? [];
          const message = parseJSXElement(path.node);
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

    transform(id: string, content: string) {
      const program = createProgram(id, content);

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

        JSXElement(path) {
          path.node.leadingComments = path.node.leadingComments ?? [];
          const message = parseJSXElement(path.node);
          if (message) {
            assignSequenceIdentifiers(message, { current: 0 });
            const replacement = generateSayJSXElement(message);
            path.replaceWith(replacement);
            path.skip();
          }
        },
      });

      return program.toString();
    },
  };
}

export default createJsxTransformer;
