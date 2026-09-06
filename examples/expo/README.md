# Expo / React Native example

A habit tracker for iOS, Android, and web, localised with
[`@saykit/react`](../../packages/integration-react) and
[`babel-plugin-saykit`](../../packages/plugin-babel).

React Native is the reason the `whitespace` prop exists. This example is where that matters.

## What it demonstrates

| Concern                                                   | Where                           |
| --------------------------------------------------------- | ------------------------------- |
| `<Say whitespace={false}>` for React Native               | `src/habit-card.tsx`            |
| Device locale via `expo-localization` + `catalogue.match` | `src/i18n.ts`                   |
| Metro/Babel wiring (no bundler plugin)                    | `babel.config.js`               |
| `@saykit/format-json`: plain flat catalogues              | `saykit.config.ts`              |
| `<Say.Plural>` with a `_0` branch, `<Say.Select>`         | `App.tsx`, `src/habit-card.tsx` |
| Multi-line JSX copy collapsing to one catalogue entry     | `App.tsx`                       |

## The `whitespace` prop

When a message contains elements, SayKit renders it by parsing `<0>…</0>` tags back into React
elements and interleaving the surrounding text. On the web a stray `" of "` between two elements is
just a text node. In React Native, a bare string that is not inside a `<Text>` throws:

> Text strings must be rendered within a `<Text>` component.

So for messages whose placeholders sit adjacent to each other, pass `whitespace={false}` and the
renderer drops whitespace-only segments:

```tsx
<Say whitespace={false}>
  <Text style={styles.strong}>{habit.thisWeek}</Text> of{' '}
  <Text style={styles.strong}>{habit.target}</Text> this week
</Say>
```

It defaults to `true`, which is what you want on the web. Only reach for `false` where the layout
would otherwise produce loose strings between elements.

## Why Babel

Metro is not a Vite/Rollup-family bundler, so `unplugin-saykit` does not apply. Metro compiles every
module through Babel, and `babel-plugin-saykit` hooks in there instead, doing the same two jobs:
rewriting the macros, and inlining `import en from './locales/en.js'` as a plain object.

```js
module.exports = function babelConfig(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'], plugins: ['saykit'] };
};
```

Note `api.cache(true)`: without it Babel re-evaluates the config per file, and the plugin's config
lookup gets repeated for no benefit.

## Locale switching

There is no URL to hang the locale off, so this app puts a store over the catalogue at module scope
and hands it to `SayProvider`. Tapping a language calls `store.set`, which swaps the view and
re-renders every `useSay` below the provider. The store is imported, not held in state, because a
device has one language at a time and nothing else needs to own it.

Catalogues are imported eagerly here rather than through a `loader`. Three small JSON files are
cheaper to bundle than to fetch over a mobile connection, and the app ships offline-first.

## Running it

```sh
pnpm install
pnpm --filter expo-example start      # then press i, a, or w
pnpm --filter expo-example extract    # after editing any message
```

> Only typechecking is verified in this repo; a native build needs Xcode or the Android SDK.

Further reading: the [React integration docs](../../website/content/integrations/react.mdx) and the
[Babel integration docs](../../website/content/integrations/babel.mdx).
