# SayKit

> Compile-time i18n for JavaScript, TypeScript, React, Next.js, TanStack Start, Carbon, and more.

[![Coverage](https://codecov.io/gh/k0d13/saykit/graph/badge.svg)](https://codecov.io/gh/k0d13/saykit)
[![pkg.pr.new](https://pkg.pr.new/badge/k0d13/saykit)](https://pkg.pr.new/~/k0d13/saykit)

SayKit is a framework-agnostic internationalisation toolkit built around compile-time message extraction, typed configuration, and small runtime primitives. You write messages inline with tagged templates or JSX, and SayKit takes care of extracting them into translation files, generating stable identifiers, and rendering them at runtime.

> [!WARNING]
> SayKit is under active development. APIs may change before the stable 1.0 release.

## Highlights

- Tagged-template and JSX authoring: `` say`Hello, ${name}!` `` or `<Say>Hello, {name}!</Say>`
- Compile-time extraction from JS, TS, JSX, and TSX via Babel or unplugin
- ICU MessageFormat support for plurals, ordinals, and select
- Typed `saykit.config.ts` with a Zod-validated schema
- A small core runtime, with optional framework adapters
- Import translation files directly: no build-time replacement, no shipped extraction

## Documentation

Full docs live at [saykit.js.org](https://saykit.js.org) (or run the [`website`](./website) workspace locally). The site covers:

- [Introduction and installation](./website/content/getting-started)
- [Messages, configuration, and the runtime](./website/content/core-concepts)
- [React and Carbon integrations](./website/content/integrations)

## Packages

This is a pnpm monorepo. The published packages live in [`packages/*`](./packages).

| Package                                             | Description                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| [`saykit`](./packages/integration)                  | Core runtime: catalogues, views, macros, and ICU formatting          |
| [`@saykit/config`](./packages/config)               | Config schema (`defineConfig`) and the `saykit` CLI                  |
| [`@saykit/react`](./packages/integration-react)     | React integration: `<Say>`, `SayProvider`, server helpers            |
| [`@saykit/carbon`](./packages/integration-carbon)   | Carbon Discord-bot integration                                       |
| [`unplugin-saykit`](./packages/plugin-unplugin)     | Universal bundler plugin (Vite, Rollup, Webpack, esbuild, Rspack, …) |
| [`babel-plugin-saykit`](./packages/plugin-babel)    | Babel plugin for SayKit                                              |
| [`@saykit/transform-js`](./packages/transform-js)   | JS/TS macro transformer (used by plugins)                            |
| [`@saykit/transform-jsx`](./packages/transform-jsx) | JSX/TSX macro transformer (used by plugins)                          |
| [`@saykit/format-po`](./packages/format-po)         | Gettext PO formatter                                                 |
| [`@saykit/format-json`](./packages/format-json)     | JSON formatter, with ARB and WebExtension dialects                   |

## Examples

End-to-end examples live in [`examples/*`](./examples). Each one is a small but complete app, with
a README explaining which parts of SayKit it exercises and why.

| Example                                             | Stack                                    | Read it for                                                      |
| --------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| [`vanilla`](./examples/vanilla)                     | TypeScript + Vite                        | The whole picture end to end, start here                         |
| [`react`](./examples/react)                         | React 19 SPA + Vite                      | Stores, rich-text messages, code-split catalogues                |
| [`nextjs`](./examples/nextjs)                       | Next.js App Router + Babel               | Server Components, `withSay`, middleware locale detection        |
| [`tanstack-start`](./examples/tanstack-start)       | TanStack Start + Vite                    | Fallback chains (`en-NZ → en-GB → en`), SSR locale negotiation   |
| [`expo`](./examples/expo)                           | Expo / React Native + Metro              | The `whitespace` prop, device locale                             |
| [`carbon`](./examples/carbon)                       | Carbon Discord bot on Cloudflare Workers | Per-locale command registration, `interaction.say` / `guild.say` |
| [`browser-extension`](./examples/browser-extension) | Chrome MV3 + Vite                        | The `webextension` JSON dialect, writing into `_locales/`        |
| [`custom-formatter`](./examples/custom-formatter)   | Node CLI + tsdown                        | Writing your own `Formatter` and `Transformer`                   |

Between them they cover the plural shapes that actually catch people out: English and French
(`one`/`other`), Polish (`one`/`few`/`many`/`other`), and Japanese (`other` only), across Gettext
PO, plain JSON, the WebExtension JSON dialect, and a hand-written YAML format.

## Quick start

```sh
pnpm add saykit @saykit/config @saykit/format-po @saykit/transform-js
```

```ts title="saykit.config.ts"
import { defineConfig } from '@saykit/config';
import po from '@saykit/format-po';
import js from '@saykit/transform-js';

export default defineConfig({
  locales: ['en', 'fr'],
  buckets: [
    {
      include: ['src/**/*.ts'],
      output: 'src/locales/{locale}.{extension}',
      formatter: po(),
      transformer: js(),
    },
  ],
});
```

```ts title="src/app.ts"
import { createCatalogue } from 'saykit';
import en from './locales/en.po';
import fr from './locales/fr.po';

const catalogue = createCatalogue({ en, fr });
const say = catalogue.locale('en');

console.log(say`Hello, ${'world'}!`);
```

```sh
pnpm saykit extract
```

Extraction only writes the source locale (the first entry in `locales`); new locales get an empty
placeholder file and existing translation files are left untouched, keeping diffs small and leaving
translated content to your TMS. Untranslated keys fall back to a configurable fallback chain (and
ultimately the source string) at load time, and `saykit clean` can prune orphaned and untranslated
entries from other locale files when your TMS doesn't do it for you.

## React

Add `@saykit/react` and `@saykit/transform-jsx`, put `jsx()` beside `js()` in the bucket, widen
`include` to `src/**/*.{ts,tsx}`, and messages become JSX:

```sh
pnpm add @saykit/react
pnpm add -D @saykit/transform-jsx
```

```tsx title="src/app.tsx"
import { Say } from '@saykit/react';
import { SayProvider } from '@saykit/react/client';
import { createCatalogue, createStore } from 'saykit';
import en from './locales/en.po';
import fr from './locales/fr.po';

const store = createStore(createCatalogue({ en, fr }), 'en');

function Cart({ name, items }: { name: string; items: string[] }) {
  return (
    <p>
      <Say>
        Hello, <strong>{name}</strong>!
      </Say>{' '}
      <Say.Plural
        _={items.length}
        _0="Your cart is empty."
        one="You have 1 item."
        other={<>You have {items.length} items.</>}
      />
    </p>
  );
}

export function App() {
  return (
    <SayProvider store={store}>
      <Cart name="Ada" items={[]} />
    </SayProvider>
  );
}
```

Elements inside a message extract as numbered tags (`Hello, <0>{name}</0>!`), so translators can
reorder them and the original elements, handlers included, are put back at render time.
`store.set('fr')` switches every `<Say>` below the provider. On the server, `getSay()` and a
`withSay` bound with `createWithSay(catalogue)` from `@saykit/react/server` do the same job per
request.

For framework-specific setup, see the [React](./website/content/integrations/react.mdx) and
[Carbon](./website/content/integrations/carbon.mdx) integration docs.

## Agent skill

A [skill](https://skills.sh) that teaches a coding agent SayKit lives in [`skills/saykit`](./skills/saykit/SKILL.md):

```sh
npx skills add k0d13/saykit
```

## Development

```sh
pnpm install
pnpm build      # build all packages
pnpm test       # run package tests
pnpm check      # type-check all packages
pnpm lint       # oxlint
pnpm format     # oxfmt
```

The repo uses [Turborepo](https://turbo.build/) for task orchestration and [Changesets](https://github.com/changesets/changesets) for versioning and publishing.
