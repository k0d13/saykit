# @saykit/format-json

> JSON file formatter for [SayKit](https://saykit.js.org).

[![Coverage](https://codecov.io/gh/k0d13/saykit/graph/badge.svg?flag=format-json)](https://codecov.io/gh/k0d13/saykit?flags%5B0%5D=format-json)

Writes one JSON catalogue per locale, the de facto format for web i18n
(react-intl, FormatJS, i18next, …). Reach for this instead of
[`@saykit/format-po`](https://github.com/k0d13/saykit/tree/main/packages/format-po)
when you want plain JSON bundles with no Gettext tooling.

## Install

```sh
pnpm add -D @saykit/format-json
```

## Usage

```ts title="saykit.config.ts"
import json from '@saykit/format-json';

// inside a bucket:
formatter: json(),
```

Each catalogue is a pretty-printed, flat map keyed by the message id (falling
back to a stable content hash when a message has no id, the same key the
runtime resolves), with the translation as the value:

```json
{
  "greeting": "Hello"
}
```

ICU MessageFormat strings are stored verbatim as JSON string values, so JSON
escaping is handled for you.

### Dialects

The plain layout above is just `{ key: value }`, so it drops comments, context,
and source references. Pass `dialect` to keep them using a richer but still
standard JSON layout:

- `dialect: 'arb'`: [Application Resource Bundle](https://github.com/google/app-resource-bundle)
  (Flutter/Dart `intl`). Strings stay flat; each key's metadata lives in a
  sibling `@key` object.
- `dialect: 'webextension'`: the Chrome/WebExtension `messages.json` shape,
  where each key maps to a `{ message, description }` object.

```ts
formatter: json({ dialect: 'arb' }),
```

```json title="ARB"
{
  "@@locale": "fr",
  "greeting": "Bonjour",
  "@greeting": {
    "description": "A friendly hello",
    "x-saykit-context": "formal",
    "x-saykit-references": ["src/app.ts:10"]
  }
}
```

Both formats carry translator comments in their native `description` field.
Context and source references have no standard slot, so SayKit round-trips them
through `x-saykit-context` / `x-saykit-references` extension fields, so other
tooling reads the `description` and safely ignores the rest.

### Options

- `dialect` (default none): `'arb'` or `'webextension'`, see above.
- `includeReferences` (default `true`): include `x-saykit-references` source
  references. No effect on the plain layout, which carries no metadata.
- `includeLineNumbers` (default `true`): include line numbers in those references.

> [!NOTE]
> JSON catalogues are keyed by message id, so give your messages explicit ids to
> get stable, human-readable keys. The plain layout carries no source
> references, comments, or contexts: it is a lean runtime format.

## Documentation

See [saykit.js.org/core-concepts/formats](https://saykit.js.org/core-concepts/formats).
