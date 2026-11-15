# unplugin-saykit

> Universal build-tool plugin for [SayKit](https://saykit.js.org).

[![Coverage](https://codecov.io/gh/k0d13/saykit/graph/badge.svg?flag=plugin-unplugin)](https://codecov.io/gh/k0d13/saykit?flags%5B0%5D=plugin-unplugin)

Works with Vite, Rollup, Rolldown, Webpack, Rspack, esbuild, Farm, and Bun via [unplugin](https://github.com/unjs/unplugin).

## Install

```sh
pnpm add -D unplugin-saykit
```

## Usage

```ts title="vite.config.ts"
import saykit from 'unplugin-saykit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [saykit()],
});
```

Import from the subpath matching your bundler: `/vite`, `/rollup`, `/rolldown`, `/webpack`, `/rspack`, `/esbuild`, `/farm`, or `/bun`.

The plugin compiles your catalogues into the `{locale}.js` modules your app imports when the build starts, and again in dev whenever a catalogue changes, so there is no `saykit compile` step to run first.

## Documentation

See [saykit.js.org/integrations/vite](https://saykit.js.org/integrations/vite).
