# babel-plugin-saykit

> Babel plugin for [SayKit](https://saykit.js.org).

[![Coverage](https://codecov.io/gh/k0d13/saykit/graph/badge.svg?flag=plugin-babel)](https://codecov.io/gh/k0d13/saykit?flags%5B0%5D=plugin-babel)

Use this for Next.js (`.babelrc`), React Native, Expo, Metro, or any Babel-driven pipeline. For Vite, Rollup, Webpack, esbuild, and similar bundlers, use [`unplugin-saykit`](https://github.com/k0d13/saykit/tree/main/packages/plugin-unplugin) instead.

## Install

```sh
pnpm add -D babel-plugin-saykit
```

## Usage

```json title=".babelrc"
{
  "plugins": ["saykit"]
}
```

```js title="babel.config.js"
export default {
  plugins: ['saykit'],
};
```

### Catalogues

By default the plugin inlines each imported catalogue into the module that imports it, which works anywhere Babel runs but does not hot-reload. Under Next.js or Metro, set `catalogues: 'module'` and let the bundler serve catalogues as real modules:

```json title=".babelrc"
{
  "presets": ["next/babel"],
  "plugins": [["saykit", { "catalogues": "module" }]]
}
```

```js title="next.config.mjs"
import { withSayKit } from 'babel-plugin-saykit/next';

export default withSayKit({
  // your config
});
```

For Metro, use `withSayKit` from `babel-plugin-saykit/metro` in `metro.config.js` instead.

## Documentation

See [saykit.js.org/integrations/babel](https://saykit.js.org/integrations/babel).
