import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/messages/index.ts', 'src/cli/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  outputOptions: { comments: { jsdoc: false } },
});
