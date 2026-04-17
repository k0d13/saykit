import type { input } from 'zod';
import { Configuration } from './shapes.js';

export function defineConfig<C extends input<typeof Configuration>>(config: C) {
  return Configuration.parse(config);
}

export type * from './shapes.js';
