# saykit

> Type-safe i18n library with compile-time macro transforms.

[![Coverage](https://codecov.io/gh/k0d13/saykit/graph/badge.svg?flag=integration)](https://codecov.io/gh/k0d13/saykit?flags%5B0%5D=integration)

The core runtime for [SayKit](https://saykit.js.org). Exports `createCatalogue`, which holds your locales and where each one's messages come from, `createView`, which binds one locale and formats messages using ICU MessageFormat, and `createStore`, which holds the current view and swaps it when you switch locale.

You author messages with the `` say`...` `` tagged template (and `say.plural`, `say.ordinal`, `say.select`), and format numbers, dates and times for the locale with `say.number`, `say.date` and `say.time`; a SayKit build-tool plugin rewrites them at build time into small runtime calls.

## Install

```sh
pnpm add saykit
```

You will normally also want [`@saykit/config`](https://github.com/k0d13/saykit/tree/main/packages/config) and a build-tool plugin ([`unplugin-saykit`](https://github.com/k0d13/saykit/tree/main/packages/plugin-unplugin) or [`babel-plugin-saykit`](https://github.com/k0d13/saykit/tree/main/packages/plugin-babel)).

## Usage

```ts
import { createCatalogue } from 'saykit';
import en from './locales/en.po';
import fr from './locales/fr.po';

const catalogue = createCatalogue({ en, fr });

const say = catalogue.locale('en');

say`Hello, ${name}!`;
say.plural(count, { one: '1 item', other: `${count} items` });
say`Total: ${say.number(total, { style: '::currency/EUR' })}`;
say.date(new Date(), { style: 'long' });
```

In a browser, where the locale can change, hold a store instead of a view:

```ts
import { createStore } from 'saykit';

const store = createStore(catalogue, 'en');

store.subscribe((say) => render(say));

await store.set('fr');

store.say`Hello, ${name}!`;
```

## Documentation

Full guide at [saykit.js.org](https://saykit.js.org).
