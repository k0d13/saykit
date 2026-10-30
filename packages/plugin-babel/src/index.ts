import { relative } from 'node:path';
import type { ConfigAPI, PluginObj, parse as Parse } from '@babel/core';
import { resolveConfig } from '@saykit/config/features/loader';

declare module '@babel/core' {
  interface PluginObj {
    parserOverride(code: string, opts: TransformOptions, parse: typeof Parse): ParseResult | null;
  }
}

/**
 * Rewrite `say` call sites into the descriptors the runtime formats.
 *
 * Catalogues load as the plain `.js` modules the CLI compiles, so nothing is intercepted.
 */
export default (_api: ConfigAPI): PluginObj => {
  const config = resolveConfig();

  return {
    name: 'saykit',

    visitor: {},

    parserOverride(code, opts, parse) {
      const id_ = opts.sourceFileName;
      if (!id_ || id_.includes('node_modules')) return parse(code, opts);

      const id = relative(process.cwd(), id_).replaceAll('\\', '/').split('?')[0]!;
      const bucket = config.buckets.find((b) => b.match(id));
      const transformed = bucket?.transformer.transform(code, id) ?? code;

      return parse(transformed, opts);
    },
  };
};
