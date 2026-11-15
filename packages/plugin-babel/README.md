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

The plugin rewrites macros. For Next.js and Metro, wrap the config with `withSayKit`, which compiles catalogues to ordinary `.js` modules before anything is bundled and recompiles them in dev:

```js title="next.config.mjs"
import { withSayKit } from 'babel-plugin-saykit/next';
export default withSayKit({});
```

```js title="metro.config.js"
const { withSayKit } = require('babel-plugin-saykit/metro');
module.exports = withSayKit(getDefaultConfig(__dirname));
```

With plain Babel, run `saykit compile` before building.

## Documentation

See [saykit.js.org/integrations/babel](https://saykit.js.org/integrations/babel).
