# @saykit/react

> React integration for [SayKit](https://saykit.js.org).

[![Coverage](https://codecov.io/gh/k0d13/saykit/graph/badge.svg?flag=integration-react)](https://codecov.io/gh/k0d13/saykit?flags%5B0%5D=integration-react)

A `<Say>` component for rendering translated content in server and client components, a `<SayProvider>` and `useSay()` for client trees, and a `withSay` and `getSay()` that mirror them on the server.

## Install

```sh
pnpm add @saykit/react saykit
```

You will also need a SayKit build-tool plugin ([`unplugin-saykit`](https://github.com/k0d13/saykit/tree/main/packages/plugin-unplugin) or [`babel-plugin-saykit`](https://github.com/k0d13/saykit/tree/main/packages/plugin-babel)) and a `saykit.config.ts` with `@saykit/transform-jsx` in the bucket. The lazy `() => import(...)` catalogues below need `unplugin-saykit` or `babel-plugin-saykit` with `catalogues: 'module'`; Babel's default inline mode only handles static imports.

## Usage

```ts title="src/i18n.ts"
import { createCatalogue, createStore } from 'saykit';

export const catalogue = createCatalogue({
  en: () => import('./locales/en.po'),
  fr: () => import('./locales/fr.po'),
});

const initial = catalogue.match(navigator.languages);
await catalogue.load(initial);

export const store = createStore(catalogue, initial);
export type Locale = (typeof catalogue.locales)[number];
```

```tsx title="src/app.tsx"
import { Say } from '@saykit/react';
import { SayProvider, useSay } from '@saykit/react/client';
import { type Locale, store } from './i18n.js';

function Cart({ name, items }: { name: string; items: string[] }) {
  return (
    <p>
      <Say>Hello, {name}!</Say>{' '}
      <Say.Plural
        _={items.length}
        _0="Your cart is empty."
        one="You have 1 item."
        other={<>You have {items.length} items.</>}
      />
    </p>
  );
}

function LocalePicker() {
  const say = useSay();
  return (
    <select value={say.locale} onChange={(event) => store.set(event.target.value as Locale)}>
      <option value="en">English</option>
      <option value="fr">Français</option>
    </select>
  );
}

export function App() {
  return (
    <SayProvider store={store}>
      <LocalePicker />
      <Cart name="Ada" items={[]} />
    </SayProvider>
  );
}
```

Elements inside a message survive translation as numbered tags: `<Say>Read the <a href="/docs">docs</a></Say>` extracts as `Read the <0>docs</0>`.

## Documentation

[React integration guide](https://saykit.js.org/integrations/react) at [saykit.js.org](https://saykit.js.org).
