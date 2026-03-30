import { rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Loader = (path: string, content: string) => Promise<unknown>;

export const js: Loader = async (path, _content) => {
  try {
    const { href } = pathToFileURL(path);
    const module = await import(href);
    return module.default;
  } catch (importError) {
    try {
      const require = globalThis.require ?? createRequire(path);
      const module = require(path);
      delete require.cache[require.resolve(path)];
      return module?.default ?? module;
    } catch (requireError) {
      throw new Error('Failed to import module', {
        cause: [importError, requireError],
      });
    }
  }
};

export const ts: Loader = async (path, content) => {
  const ts = await import('typescript');
  const outputPath = `${path}.${Date.now()}.js`;

  try {
    const tsConfigPath = ts.findConfigFile(dirname(path), ts.sys.fileExists) || 'tsconfig.json';
    const { config: tsConfig, error } = ts //
      .readConfigFile(tsConfigPath, ts.sys.readFile);
    if (error) throw error;

    tsConfig.compilerOptions = {
      ...tsConfig.compilerOptions,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      noEmit: false,
    };

    const transpiledContent = ts.transpileModule(content, tsConfig).outputText;
    await writeFile(outputPath, transpiledContent);

    return await js(outputPath, transpiledContent);
  } catch (error) {
    throw new Error('Failed to import module', {
      cause: error,
    });
  } finally {
    if (ts.sys.fileExists(outputPath)) await rm(outputPath);
  }
};

export default Object.freeze({
  '.js': js,
  '.mjs': js,
  '.cjs': js,
  '.ts': ts,
  '.mts': ts,
  '.cts': ts,
});
