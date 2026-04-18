import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

export type Loader = (path: string, content: string) => unknown;

function transpileAndRequire(path: string, content: string) {
  const require = createRequire(path);
  const ts = require('typescript');
  const outputPath = `${path}.${process.pid}.saykit.config.cjs`;

  try {
    const tsConfigPath = ts.findConfigFile(dirname(path), ts.sys.fileExists);
    const { config: tsConfig, error } = tsConfigPath
      ? ts.readConfigFile(tsConfigPath, ts.sys.readFile)
      : { config: {}, error: null };
    if (error) throw error;

    tsConfig.compilerOptions = {
      ...tsConfig.compilerOptions,
      allowJs: true,
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      noEmit: false,
    };

    const transpiledContent = ts.transpileModule(content, tsConfig).outputText;
    writeFileSync(outputPath, transpiledContent);

    const resolved = require.resolve(outputPath);
    delete require.cache[resolved];

    const module = require(outputPath);
    delete require.cache[resolved];
    return module?.default ?? module;
  } catch (error) {
    throw new Error('Failed to import module', { cause: error });
  } finally {
    if (ts.sys.fileExists(outputPath)) rmSync(outputPath);
  }
}

export const js: Loader = (path, content) => transpileAndRequire(path, content);
export const ts: Loader = (path, content) => transpileAndRequire(path, content);

export const configLoaders = Object.freeze({
  '.js': js,
  '.mjs': js,
  '.cjs': js,
  '.ts': ts,
  '.mts': ts,
  '.cts': ts,
});
