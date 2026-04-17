import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/parser.ts', 'src/generator.ts'],
});
