import { relative } from 'node:path';
import type { PluginObj } from '@babel/core';
import { parse } from '@babel/parser';
import { resolveConfig } from '@saykit/config/features/loader';

// TODO: this does not need to be in this file, can move somewhere shared?
function transformSource(id_: string, content: string) {
  const config = resolveConfig();
  const id = relative(process.cwd(), id_).replaceAll('\\', '/').split('?')[0]!;
  const bucket = config.buckets.find((b) => b.match(id));
  return bucket?.transformer.transform(id, content) ?? content;
}

export default function (): PluginObj {
  return {
    name: 'saykit',
    visitor: {
      Program(path, state) {
        const filename = state.file.opts.filename;
        if (!filename || filename.includes('node_modules')) return;

        const original = state.file.code ?? '';
        const transformed = transformSource(filename, original);

        if (transformed !== original) {
          const ast = parse(transformed, state.file.opts.parserOpts as any);
          path.replaceWith(ast.program);
          path.skip();
        }
      },
    },
  };
}
