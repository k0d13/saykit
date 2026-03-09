import type { input } from 'zod';
import type { Configuration } from './shapes.js';

export function defineConfig<C extends input<typeof Configuration>>(config: C): C {
  return config;
}
