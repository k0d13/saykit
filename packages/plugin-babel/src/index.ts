import type { ConfigAPI, PluginObj, parse as Parse } from '@babel/core';
import { loadConfig } from '@saykit/config';

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
  const config = loadConfig();

  return {
    name: 'saykit',

    visitor: {},

    parserOverride(code, opts, parse) {
      const id = opts.sourceFileName;
      if (!id || id.includes('node_modules')) return parse(code, opts);

      return parse(config.transform(code, id) ?? code, opts);
    },
  };
};
