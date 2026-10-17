# Vanilla example

A library "My loans" page written in plain TypeScript against the DOM: no framework,
no runtime i18n library. Just the [`saykit`](../../packages/integration) core runtime and
[`unplugin-saykit`](../../packages/plugin-unplugin) wired into Vite.

This is the smallest complete picture of how SayKit works, and the best example to read first.

## What it demonstrates

| API                                                           | Where                                 |
| ------------------------------------------------------------- | ------------------------------------- |
| `createCatalogue({ ...messages })`                            | `src/i18n.ts`                         |
| `catalogue.match(navigator.languages)`, locale detection      | `src/main.ts`                         |
| `catalogue.locale(code)`, runtime locale switching            | `src/main.ts` (the language picker)   |
| `` say`…` `` with interpolation                               | `src/main.ts`                         |
| `say({ context })` to disambiguate identical source text      | `src/main.ts` (`My loans`)            |
| `say.plural` with CLDR categories **and** an exact `0` case   | `renderSummary`                       |
| `say.ordinal`, nested _inside_ a `` say`…` `` template        | `renderSummary`                       |
| `say.select` over a union type                                | `statusLabel`                         |
| `// Translators:` comments carried into the catalogue         | `dueLabel`, `renderSummary`           |
| `say.locale` fed to `Intl.NumberFormat` / `Intl.DisplayNames` | `renderSummary`, `renderLocalePicker` |

The locale set is deliberate: **en** (source), **fr**, **pl** (four plural categories, so
`one`/`few`/`many`/`other` all matter), and **ja** (no plural distinction at all). A catalogue that
reads correctly in all four is a catalogue that is actually internationalised.

## Running it

```sh
pnpm install
pnpm --filter vanilla-example dev
```

## Changing the copy

Edit a message in `src/main.ts`, then re-extract:

```sh
pnpm --filter vanilla-example extract
```

Extraction rewrites `src/locales/en.po` (the source locale) and leaves `fr`, `pl`, and `ja`
untouched, adding only the new empty entries. Untranslated keys fall back to the source string at
build time, so the app never renders a raw message id. Use `saykit clean` to prune entries that no
longer exist in the source.

## How the build fits together

`unplugin-saykit/vite` does two things (see `vite.config.ts`):

1. **transform** rewrites `` say`Due in ${n} days` `` into a `say.call({ id, … })` with a stable
   hashed id. The macro bodies in the runtime throw if this step is missing, so a misconfigured
   build fails loudly rather than silently shipping English.
2. **load** turns `import en from './locales/en.js'` into a plain JS object. No PO parser reaches
   the browser bundle.

Further reading: [core concepts](../../website/content/core-concepts) and the
[Vite integration docs](../../website/content/integrations).
