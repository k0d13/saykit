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

The plugin only rewrites macros. Catalogues are compiled to ordinary `.js` modules by `saykit compile`, so Next.js and Metro need no extra configuration.

## Documentation

See [saykit.js.org/integrations/babel](https://saykit.js.org/integrations/babel).
