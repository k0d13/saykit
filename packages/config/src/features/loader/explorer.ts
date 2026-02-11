import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

function getFilesToTry<Name extends string>(name: Name) {
  return [
    `.${name}rc`,
    `.${name}rc.json`,
    `.${name}rc.yaml`,
    `.${name}rc.yml`,
    `.${name}rc.js`,
    `.${name}rc.cjs`,
    `.${name}rc.mjs`,
    `.${name}rc.ts`,
    `.${name}rc.mts`,
    `.${name}rc.cts`,

    `${name}.config.json`,
    `${name}.config.js`,
    `${name}.config.cjs`,
    `${name}.config.mjs`,
    `${name}.config.ts`,
    `${name}.config.mts`,
    `${name}.config.cts`,

    'package.json',
  ] as const;
}

export async function findConfigFile(moduleName: string, projectDir: string) {
  for (const fileName of getFilesToTry(moduleName)) {
    try {
      const id = join(projectDir, fileName);
      await access(id);
      const content = await readFile(id, 'utf8');
      return { id, content };
    } catch {}
  }

  return null;
}
