import { generate } from '@babel/generator';
import * as parser from '@babel/parser';
import traverse_ from '@babel/traverse';
import type { Transformer } from '@saykit/config';
import { assignSequenceIdentifiers, CompositeMessage } from '@saykit/config/features/messages';
import { generateSayCallExpression, isLoneArgument } from '@saykit/transform-js/generator';
import {
  collectLeadingComments,
  isEquivalentPlaceholder,
  parseExpression,
} from '@saykit/transform-js/parser';
import { generateSayJSXElement } from './generator.js';
import { parseJSXElement } from './parser.js';

const traverse = ((traverse_ as any).default || traverse_) as typeof traverse_;

function createProgram(code: string, id: string) {
  const program = parser.parse(code, {
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

    extract(code: string, id: string) {
      const program = createProgram(code, id);
      const messages: CompositeMessage[] = [];

      traverse(program, {
        Expression(path) {
          // Only extraction cares where a comment was written: the transform
          // leaves comments where they are, and moving them would duplicate
          // them into the generated call
          path.node.leadingComments = collectLeadingComments(path);
          const message = parseExpression(path.node);
          if (message) {
            assignSequenceIdentifiers(message, { current: 0 }, isEquivalentPlaceholder);
            messages.push(message);
            path.skip();
          }
        },

        JSXElement(path) {
          path.node.leadingComments = collectLeadingComments(path);
          const message = parseJSXElement(path.node);
          if (message) {
            assignSequenceIdentifiers(message, { current: 0 }, isEquivalentPlaceholder);
            messages.push(message);
            path.skip();
          }
        },
      });

      // A lone value carries nothing a translator could change, so it never
      // reaches the catalogue: the transform formats it directly
      // TODO: Can this just return the messages themselves, and be converted upstream
      return messages
        .filter((message) => !isLoneArgument(message))
        .map((message) => ({
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
          const message = parseExpression(path.node);
          if (message) {
            assignSequenceIdentifiers(message, { current: 0 }, isEquivalentPlaceholder);
            const replacement = generateSayCallExpression(message);
            path.replaceWith(replacement);
            path.skip();
          }
        },

        JSXElement(path) {
          const message = parseJSXElement(path.node);
          if (message) {
            assignSequenceIdentifiers(message, { current: 0 }, isEquivalentPlaceholder);
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
