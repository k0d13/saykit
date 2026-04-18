import { extname } from 'node:path';
import { Configuration } from '~/shapes.js';
import { findConfigFile } from './files.js';
import { configLoaders } from './module.js';

function unwrapNamedConfig(config: object, name: string) {
  if (!(name in config) || !config[name as keyof object]) return config;
  return config[name as keyof object];
}

export function resolveConfig(name = 'saykit') {
  const file = findConfigFile(name, process.cwd());
  if (!file) throw new Error(`Could not find config file for "${name}"`);

  const ext = extname(file.id).toLowerCase();
  const load = ext in configLoaders ? configLoaders[ext as keyof typeof configLoaders] : null;
  if (!load) throw new Error(`Unsupported config file type "${ext}" for "${name}"`);

  let config = load(file.id, file.content);
  if (!config || typeof config !== 'object') throw new Error(`Invalid config file for "${name}"`);
  config = unwrapNamedConfig(config, name);

  const result = Configuration.safeParse(config);
  if (result.error) throw new Error(`Invalid config file for "${name}"`, { cause: result.error });

  return result.data;
}
