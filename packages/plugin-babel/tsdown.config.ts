import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/next.ts', 'src/metro.ts'],
  format: 'cjs',
  outputOptions: { comments: { jsdoc: false } },
});
