import { extname } from 'node:path';
import type { Config } from '#/shapes.js';
import { findConfigFile } from './files.js';
import { configLoaders } from './module.js';

/**
 * The config file {@link resolveConfig} would load, for callers that need the
 * path itself rather than its contents, salting a bundler's cache key with it,
 * for one, since what a catalogue assembles into depends on the config.
 */
export function resolveConfigFile(name = 'saykit') {
  const file = findConfigFile(name, process.cwd());
  if (!file) throw new Error(`Could not find config file for "${name}"`);

  return file.id;
}

export function resolveConfig(name = 'saykit') {
  const id = resolveConfigFile(name);

  const ext = extname(id).toLowerCase();
  const load = ext in configLoaders ? configLoaders[ext as keyof typeof configLoaders] : null;
  if (!load) throw new Error(`Unsupported config file type "${ext}" for "${name}"`);

  const config = load(id);
  if (!config || typeof config !== 'object') throw new Error(`Invalid config file for "${name}"`);

  return config as Config;
}
