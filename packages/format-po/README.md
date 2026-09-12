# @saykit/format-po

> Gettext PO file formatter for [SayKit](https://saykit.js.org).

[![Coverage](https://codecov.io/gh/k0d13/saykit/graph/badge.svg?flag=format-po)](https://codecov.io/gh/k0d13/saykit?flags%5B0%5D=format-po)

The default formatter used in every SayKit example.

## Install

```sh
pnpm add -D @saykit/format-po
```

## Usage

```ts title="saykit.config.ts"
import po from '@saykit/format-po';

// inside a bucket:
formatter: po(),
```

### Options

- `includeReferences` (default `true`): include `#: file:line` source references.
- `includeLineNumbers` (default `true`): include line numbers in those references.

## Documentation

See [saykit.js.org/core-concepts/formats](https://saykit.js.org/core-concepts/formats).
