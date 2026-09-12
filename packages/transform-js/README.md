# @saykit/transform-js

> JavaScript and TypeScript transformer for [SayKit](https://saykit.js.org).

[![Coverage](https://codecov.io/gh/k0d13/saykit/graph/badge.svg?flag=transform-js)](https://codecov.io/gh/k0d13/saykit?flags%5B0%5D=transform-js)

Extracts and rewrites SayKit macros in `.js`, `.cjs`, `.mjs`, `.ts`, `.mts`, and `.cts` files. Used inside a `saykit.config.ts` bucket.

## Install

```sh
pnpm add -D @saykit/transform-js
```

## Usage

```ts title="saykit.config.ts"
import js from '@saykit/transform-js';

// inside a bucket:
transformer: js(),
```

For JSX/TSX, combine with [`@saykit/transform-jsx`](https://github.com/k0d13/saykit/tree/main/packages/transform-jsx):

```ts
import js from '@saykit/transform-js';
import jsx from '@saykit/transform-jsx';

// inside a bucket:
transformer: [js(), jsx()],
```

## Documentation

See [saykit.js.org](https://saykit.js.org).
