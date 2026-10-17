import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/*.ts', '!src/*.test.ts'],
  outputOptions: { comments: { jsdoc: false } },
  // unplugin types the rolldown plugin as rolldown's own, which would otherwise
  // be inlined as a copy that no longer matches the consumer's rolldown
  deps: { neverBundle: ['rolldown'] },
});
