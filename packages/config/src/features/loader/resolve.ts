import { extname } from 'node:path';
import { Configuration } from '~/shapes.js';
import { findConfigFile } from './explorer.js';
import loaders from './loaders.js';

export async function useConfig(name = 'saykit') {
  const file = await findConfigFile(name, process.cwd());
  if (!file) throw new Error(`Could not find config file for "${name}"`);

  const ext = extname(file.id).toLowerCase();
  const loader = ext in loaders ? loaders[ext as keyof typeof loaders] : loaders[''];

  let config = await loader(file.id, file.content);
  if (!config || typeof config !== 'object') throw new Error(`Invalid config file for "${name}"`);
  if (config && typeof config === 'object' && 'saykit' in config) config = config.saykit;

  const result = await Configuration.safeParseAsync(config);
  if (result.error)
    throw new Error(`Invalid config file for "${name}"`, {
      cause: result.error,
    });

  return result.data;
}
