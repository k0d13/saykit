import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SUPPORTED_CONFIG_FILES = [
  'saykit.config.js',
  'saykit.config.cjs',
  'saykit.config.mjs',
  'saykit.config.ts',
  'saykit.config.mts',
  'saykit.config.cts',
] as const;

export function getConfigFileCandidates(name: string) {
  return SUPPORTED_CONFIG_FILES.map((file) => file.replace('saykit', name));
}

export function findConfigFile(moduleName: string, projectDir: string) {
  for (const fileName of getConfigFileCandidates(moduleName)) {
    const id = join(projectDir, fileName);
    if (!existsSync(id)) continue;

    return {
      id,
      content: readFileSync(id, 'utf8'),
    };
  }

  return null;
}
