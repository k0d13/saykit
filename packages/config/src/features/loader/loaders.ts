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

export const json: Loader = async (_path, content) => {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error('Failed to parse JSON', {
      cause: error,
    });
  }
};

namespace YAML {
  type YAMLValue = string | number | boolean | null | YAMLObject | YAMLArray;
  type YAMLObject = { [key: string]: YAMLValue };
  type YAMLArray = YAMLValue[];

  type StackFrame = { indent: number; container: YAMLObject | YAMLArray };

  export function parse(text: string) {
    const lines = text
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '')
      .map((l) => [l.match(/^\s*/)![0].length, l] as const);
    const root: YAMLObject = {};
    const stack: [StackFrame, ...StackFrame[]] = [
      { indent: -1, container: root },
    ];

    function parseValue(value: string, fallback?: YAMLValue): YAMLValue {
      if (value === 'true') return true;
      if (value === 'false') return false;
      if (!Number.isNaN(Number(value)) && value !== '') return Number(value);
      if (value.startsWith('[') && value.endsWith(']')) {
        return value
          .slice(1, -1)
          .split(',')
          .map((e) => parseValue(e.trim()));
      }
      return value || fallback || value;
    }

    for (let [indent, line] of lines) {
      const parent = stack.at(-1)!;
      while (stack.length > 1 && indent <= parent.indent) stack.pop();

      if (line.startsWith('- ')) {
        line = line.slice(2).trim();

        let value: YAMLValue;
        if (line === '') {
          value = {};
        } else if (line.includes(':')) {
          const [k, ...r] = line.split(':');
          value = { [k!.trim()]: parseValue(r.join(':').trim()) };
        } else {
          value = parseValue(line);
        }

        if (!Array.isArray(parent.container)) {
          const upper = stack.at(-2)!;

          if (!Array.isArray(upper.container)) {
            for (const key in upper.container) {
              if (upper.container[key] === parent.container) {
                upper.container[key] = [value];
                stack.push({ indent, container: upper.container[key] });
                break;
              }
            }
          } else {
            throw new Error(
              'Invalid YAML: expected parent object for array conversion',
            );
          }
        } else {
          parent.container.push(value);
        }

        if (typeof value === 'object' && value && !Array.isArray(value)) {
          stack.push({ indent, container: value });
        }
      } else {
        const [key, ...rest] = line.split(':');
        const value = parseValue(rest.join(':').trim(), {});

        if (!Array.isArray(parent.container)) {
          parent.container[key!.trim()] = value;
        } else {
          throw new Error('Invalid YAML: cannot assign key to non-object');
        }

        if (typeof value === 'object' && value && !Array.isArray(value)) {
          stack.push({ indent, container: value });
        }
      }
    }

    return root;
  }
}

export const yaml: Loader = async (_path, content) => {
  try {
    return YAML.parse(content);
  } catch (error) {
    throw new Error('Failed to parse YAML', {
      cause: error,
    });
  }
};

export const ts: Loader = async (path, content) => {
  const ts = await import('typescript');
  const outputPath = `${path}.${Date.now()}.js`;

  try {
    const tsConfigPath =
      ts.findConfigFile(dirname(path), ts.sys.fileExists) || 'tsconfig.json';
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

export const detect: Loader = async (path, content) => {
  try {
    return await yaml(path, content);
  } catch {
    try {
      return await json(path, content);
    } catch {
      return undefined;
    }
  }
};

export default Object.freeze({
  '.js': js,
  '.mjs': js,
  '.cjs': js,
  '.json': json,
  '.yaml': yaml,
  '.yml': yaml,
  '': detect,
  '.ts': ts,
  '.mts': ts,
  '.cts': ts,
});
