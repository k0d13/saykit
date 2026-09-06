import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'cjs',
  outputOptions: { comments: { jsdoc: false } },
});
