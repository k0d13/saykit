import { generate } from '@babel/generator';
import * as parser from '@babel/parser';
import traverse_ from '@babel/traverse';
import { Context } from './context.js';
import { Visitor } from './visitor.js';

const traverse = (traverse_ as any).default || (traverse_ as typeof traverse_);

const supportedExtensions = ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.mts', '.cts', '.tsx'];

export function parseProgram(id: string, code: string) {
  // Check if the file extension is supported
  if (!supportedExtensions.some((ext) => id.endsWith(ext))) return null;

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

  const context = new Context(program.comments ?? []);

  return { program, context };
}

export function applyVisitor(program: parser.ParseResult, context: Context) {
  const visitor = new Visitor(context);
  traverse(program, visitor.toHandlers());
}

export function printProgram(program: parser.ParseResult) {
  return generate(program.program, {
    comments: true,
    compact: false,
    retainLines: true,
  });
}

export function collectMessages(id: string, code: string) {
  const result = parseProgram(id, code);
  if (result) applyVisitor(result.program, result.context);
  return result?.context.foundMessages ?? [];
}

export function transformCode(id: string, code: string) {
  const result = parseProgram(id, code);
  if (result) applyVisitor(result.program, result.context);
  return result?.context.foundMessages.length ? printProgram(result.program) : code;
}
