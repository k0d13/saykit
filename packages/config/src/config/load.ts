import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import * as z from 'zod';
import { type Resolved, resolveConfig } from './resolve.js';
import { Config } from './schema.js';

const CANDIDATES = ['js', 'cjs', 'mjs', 'ts', 'mts', 'cts'].map((ext) => `saykit.config.${ext}`);
const TYPESCRIPT = new Set(['.ts', '.mts', '.cts']);

/** Requires `path` without leaving it in (or reading it from) the require cache. */
function requireFresh(path: string) {
  const require = createRequire(path);
  const resolved = require.resolve(path);
  delete require.cache[resolved];
  const module = require(path);
  delete require.cache[resolved];
  return module?.default ?? module;
}

/**
 * Adds what the runtime cannot: why a config it could not read is one it will
 * never read. Everything else is the config's own problem, and its error
 * already describes that better than we could.
 */
function diagnose(error: unknown, path: string) {
  const code = (error as NodeJS.ErrnoException | null)?.code;

  if (code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX') {
    return 'Enums, namespaces and parameter properties are not erasable, so no runtime will read them.';
  }
  if (code === 'ERR_REQUIRE_ASYNC_MODULE') {
    return 'The config is loaded synchronously, so it cannot use top-level await.';
  }

  // A runtime with no TypeScript support parses the annotations as JavaScript
  // and chokes on the first one, leaving a plain `SyntaxError` to say so. One
  // that does support it reports its own syntax errors with a code, so an
  // uncoded `SyntaxError` here is never the config's fault
  const unreadable =
    code === 'ERR_UNKNOWN_FILE_EXTENSION' || (!code && error instanceof SyntaxError);
  if (unreadable && TYPESCRIPT.has(extname(path).toLowerCase())) {
    return 'Reading this config needs Node 22.18+, or a runtime that loads TypeScript itself (Bun, Deno, tsx).';
  }
}

/**
 * Finds the config in `cwd`, loads it as it sits on disk and validates it. The runtime deals with
 * the extension and nothing is copied or rewritten, so `__dirname`, `import.meta.dirname`,
 * relative specifiers and `require.resolve` all resolve against the config's own directory.
 */
export function load(cwd: string): Resolved {
  const file = CANDIDATES.map((name) => join(cwd, name)).find((path) => existsSync(path));
  if (!file) throw new Error(`Could not find config file in ${cwd}`);

  let raw: unknown;
  try {
    raw = requireFresh(file);
  } catch (error) {
    const hint = diagnose(error, file);
    throw new Error(hint ? `Failed to import module. ${hint}` : 'Failed to import module', {
      cause: error,
    });
  }

  const parsed = Config.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid config ${file}\n${z.prettifyError(parsed.error)}`);
  return resolveConfig(parsed.data, file);
}
