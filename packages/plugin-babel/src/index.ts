import { relative } from 'node:path';
import type { PluginObj } from '@babel/core';
import { parse } from '@babel/parser';
import { resolveConfig } from '@saykit/config/features/loader';

export default function (): PluginObj {
  const config = resolveConfig();

  return {
    name: 'saykit',
    visitor: {
      Program(path, state) {
        const id_ = state.file.opts.filename;
        if (!id_ || id_.includes('node_modules')) return;
        const code = state.file.code ?? '';

        const id = relative(process.cwd(), id_).replaceAll('\\', '/').split('?')[0]!;
        const bucket = config.buckets.find((b) => b.match(id));
        const transformed = bucket?.transformer.transform(id, code) ?? code;

        if (transformed !== code) {
          const ast = parse(transformed, state.file.opts.parserOpts as any);
          path.replaceWith(ast.program);
          path.skip();
        }
      },
    },
  };
}
