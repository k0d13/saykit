---
name: saykit
description: Use when adding, changing, or debugging internationalisation with SayKit (the `saykit`, `@saykit/*`, `unplugin-saykit`, or `babel-plugin-saykit` packages), or when a project has a saykit.config.ts. Covers setup, the say and <Say> macros, plurals and formatting, catalogues, views and stores, React client and server usage, extraction, and the mistakes agents make most.
---

# SayKit

Compile-time i18n. Messages are written inline, `` say`Hello, ${name}!` `` or `<Say>Hello, {name}!</Say>`. A build plugin extracts them to translation files and rewrites each macro to `say.call({ id, ... })`. Translation files are imported like modules and the bundler turns them into plain objects. The runtime is ICU MessageFormat and nothing else.

Docs: https://saykit.js.org. Source and end-to-end examples (`examples/*`): https://github.com/k0d13/saykit.

Written for SayKit **0.10**. All SayKit packages are released together and must share one version; if the project's `saykit` version differs from this, prefer the installed version's docs and tell the user to run `npx skills update` (or `npx skills add k0d13/saykit`) for the matching skill. Pre-1.0, so APIs still move between minors.

## Packages

| Package                 | Purpose                                                                     | When                                                         |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `saykit`                | Runtime: `createCatalogue`, `createStore`, the `say` macros, ICU formatting | Always, a runtime dependency                                 |
| `@saykit/config`        | `defineConfig` and the `saykit` CLI (`extract`, `clean`)                    | Always, dev dependency                                       |
| `@saykit/transform-js`  | Extracts and rewrites `say` macros in `.js`/`.ts`                           | Always                                                       |
| `@saykit/transform-jsx` | Same for `<Say>` in `.jsx`/`.tsx`                                           | Any JSX                                                      |
| `@saykit/format-po`     | Gettext PO catalogues                                                       | Default choice, translators and TMSes know it                |
| `@saykit/format-json`   | JSON catalogues; `arb` and `webextension` dialects                          | Flutter-style ARB, browser extension `_locales/`, plain JSON |
| `unplugin-saykit`       | Bundler plugin                                                              | Vite, Rollup, Rolldown, Webpack, Rspack, esbuild, Farm, Bun  |
| `babel-plugin-saykit`   | Babel plugin, plus Next.js and Metro catalogue loaders                      | Next.js, Expo, React Native, any Babel pipeline              |
| `@saykit/react`         | `<Say>`, `SayProvider`, `useSay`, `withSay`, `getSay`                       | React                                                        |
| `@saykit/carbon`        | `SayPlugin`, `withSay`, `interaction.say`, `guild.say`                      | Carbon Discord bots                                          |

A project needs the runtime, config, one formatter, the transformers for its file types, and one plugin. Use the project's own package manager.

## Setup

### `saykit.config.ts`

At the project root. A TypeScript config needs Node 22.18+, or Bun, Deno or tsx.

```ts
import { defineConfig } from '@saykit/config';
import po from '@saykit/format-po';
import js from '@saykit/transform-js';
import jsx from '@saykit/transform-jsx';

export default defineConfig({
  // The first locale is the source locale: the language the code is written
  // in, the only one extraction writes, and the final fallback for every other
  locales: ['en', 'en-GB', 'en-NZ', 'fr'],
  // Optional chains between a locale and the source, most specific first.
  // Every key and value must also appear in `locales`
  fallbackLocales: { 'en-NZ': ['en-GB'] },
  buckets: [
    {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.*.ts'],
      // Must contain {locale} and end in .{extension}
      output: 'src/locales/{locale}.{extension}',
      formatter: po(),
      transformer: [js(), jsx()],
      // Optional: strings with no call site (a manifest, a store listing), keyed by id
      messages: { extensionName: 'Reading Time' },
    },
  ],
});
```

A bucket is "these files in, this catalogue out". One bucket is the norm, including for a Next.js app where server and client components share a catalogue. Add more only when two areas genuinely want separate files, such as transactional emails beside a UI.

### Bundler

Vite, and every other bundler `unplugin` supports (change only the import path: `/rollup`, `/rolldown`, `/webpack`, `/rspack`, `/esbuild`, `/farm`, `/bun`):

```ts title="vite.config.ts"
import react from '@vitejs/plugin-react';
import saykit from 'unplugin-saykit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [saykit(), react()],
});
```

Next.js. Adding a `.babelrc` switches Next from SWC to Babel; there is no SWC plugin:

```json title=".babelrc"
{
  "presets": ["next/babel"],
  "plugins": [["saykit", { "catalogues": "module" }]]
}
```

```js title="next.config.mjs"
import { withSayKit } from 'babel-plugin-saykit/next';

export default withSayKit({
  // your config
});
```

Expo and React Native:

```js title="babel.config.js"
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['saykit', { catalogues: 'module' }]],
  };
};
```

```js title="metro.config.js"
const { getDefaultConfig } = require('expo/metro-config');
const { withSayKit } = require('babel-plugin-saykit/metro');

module.exports = withSayKit(getDefaultConfig(__dirname));
```

Plain Babel, no bundler integration:

```js title="babel.config.js"
export default {
  plugins: ['saykit'],
};
```

The Babel plugin's `catalogues` option decides where a catalogue import is assembled. The default `'inline'` bakes the catalogue into the importing module, so Babel alone is enough with no bundler configuration, which is right for a plain Babel build or a library. Its cost is hot reload: an edited `.po` does not change the importer's bytes, so new strings appear only after a cache clear (`expo start --clear`, deleting `.next`). `'module'` leaves the import alone and lets the Next.js or Metro `withSayKit` serve the catalogue as a real, hot-reloadable module; set it whenever one of those is wired up. Only static imports are handled by the Babel plugin; `import('./locales/fr.po')` goes through the bundler.

### TypeScript

```json title="tsconfig.json"
{
  "compilerOptions": {
    "allowArbitraryExtensions": true
  }
}
```

Needed for `.po` imports. JSON needs `resolveJsonModule`, which `moduleResolution: "bundler"` implies. Extraction writes a `{locale}.d.po.ts` beside each catalogue declaring `Record<string, string>`; never edit those, and never rely on them at runtime, the plugin produces the real module.

## Writing messages

### TypeScript

```ts
say`Hello, ${name}!`; // Hello, {name}!
say`Total: ${{ cartTotal: getTotal() }}`; // Total: {cartTotal}
say`Hello, ${user.name}`; // Hello, {0}   (not an identifier, so numbered)

say.plural(count, { 0: 'No items', one: '1 item', other: `${count} items` });
say.ordinal(n, { 1: `${n}st`, 2: `${n}nd`, 3: `${n}rd`, other: `${n}th` });
say.select(status, { active: 'Active', archived: 'Archived', other: 'Unknown' });
```

A placeholder is named after the variable when the expression is a bare identifier. Anything else is numbered, which tells a translator nothing; name it with a single-key object, `${{ name: user.name }}`, or lift it into a local first. Keep a sentence in one message: ``say`Hello, ` + name`` gives a translator half a sentence.

`plural`, `ordinal` and `select` need `other`. Exact-number branches are plain digits. Interpolating the selector inside a branch extracts as ICU `#`. Branch keys are ICU keys, identifiers with no hyphens or spaces: `'sold-out'` fails the build, and the fix is to rename the discriminant at its source to `soldOut`, since `select` compares literal strings and a renamed branch would never match.

### Context and comments

Identical strings that mean different things get a `context`, which gives them separate catalogue entries and shows the translator which is which. A custom `id` gives an optional readable key

```ts
say({ context: 'noun' })`Post`;
say({ context: 'verb' })`Post`;
say({ id: 'checkout.review' })`Review your order`;
say({ id: 'nav.right', context: 'direction' })`Right`;
```

A comment starting with `TRANSLATORS:` directly above a message is extracted alongside it; use it for tone, length limits and anything a translator could not infer. Other comments stay in code.

```ts
// TRANSLATORS: Button text, keep under 20 characters
say`Continue`;
```

### Numbers, dates and times

```ts
say`Published ${say.date(post.at, { style: 'long' })}`; // Published {0, date, long}
say`Total ${say.number(total, { style: '::currency/EUR' })}`; // Total {0, number, ::currency/EUR}
say.number(1234.5); // "1,234.5" in en, "1 234,5" in fr
say.time(opensAt, { style: 'short' });
```

Inside a message the format lands in the catalogue, so a locale can move the number. Alone, the value is formatted for the view's locale but nothing is extracted, there is nothing to translate. `number` styles: `integer`, `percent`, a skeleton (`::currency/EUR`, `::compact-short`), or a pattern (`#,##0.00`). `date` and `time` styles: `short`, `medium`, `long`, `full`, or a skeleton (`::yMMMM`, `::Hm`). There is no `currency` style, only the skeleton. Unknown styles fail the build.

### JSX

```tsx
import { Say } from '@saykit/react';

<Say>Hello, {name}!</Say>
<Say>Hello, {{ name: user.name }}!</Say>
<Say context="noun">Post</Say>
<Say id="checkout.review">Review your order</Say>

{/* TRANSLATORS: Shown on an empty board */}
<Say>Nothing here yet.</Say>

// Elements become tags a translator can move: "Read the <0>docs</0>".
// say-tag names one: "Read the <link>docs</link>". Name it after what it does to the text.
<Say>Read the <a href="/docs" say-tag="link">docs</a></Say>

<Say.Plural _={count} _0="Nothing here" one={<>{count} item</>} other={<>{count} items</>} />
<Say.Ordinal _={n} _1={<>{n}st</>} _2={<>{n}nd</>} _3={<>{n}rd</>} other={<>{n}th</>} />
<Say.Select _={status} active="Active" archived="Archived" other="Unknown" />

<Say>Due <Say.Date _={dueAt} style="medium" /></Say>
<Say.Number _={row.total} style="::currency/EUR" />
```

`_` is the selector. Exact-number branches are `_0`, `_1` because a prop cannot start with a digit; extraction strips the underscore. A branch that shows the number must be a fragment, not a string. `{' '}` inside `<Say>` folds into the text. `whitespace` defaults to `true`; pass `whitespace={false}` in React Native when `<Text>` elements sit next to each other, otherwise a bare string outside `<Text>` throws.

## Runtime

Three objects. A **catalogue** holds locales and where their messages come from. A **view** is one locale bound to its messages: callable, immutable, and what application code holds. A **store** holds the current view and swaps it, which is what switching locale in a browser is.

```ts title="src/i18n.ts"
import { createCatalogue, createStore } from 'saykit';
import en from './locales/en.po';

export const catalogue = createCatalogue({
  en, // inline
  fr: () => import('./locales/fr.po'), // lazy: one chunk, fetched on first load
});

// No Locale type is exported; derive it
export type Locale = (typeof catalogue.locales)[number];
```

`createCatalogue` takes a record whose keys are the locales; the first is the fallback `match` resolves to. Never write the messages by hand: keys are content hashes the transform chose, so a hand-written `{ greeting: 'Hello' }` matches nothing. Import the extracted file.

```ts
catalogue.locales; // ['en', 'fr']
catalogue.match(navigator.languages, cookieLocale); // exact, then language prefix, then locales[0]; nullish guesses are skipped
catalogue.loaded('fr'); // false until loaded
const say = await catalogue.load('fr'); // calls the thunk once; synchronous when already loaded
catalogue.locale('fr'); // synchronous; throws if a lazy locale has not been loaded
for (const [locale, say] of catalogue) {
} // every locale's view

say.locale; // 'fr'
say`Hello`; // formats against fr
```

`fallbackLocales` and `match` are different fallbacks. `fallbackLocales` is build time, it decides which files are merged into a locale's catalogue so an untranslated key resolves to another locale's string. `match` is runtime, it decides which key of the catalogue a guess maps to, and never resolves to a locale that is not a key.

Browser, where the locale changes:

```ts
export const store = createStore(catalogue, catalogue.match(navigator.languages));

store.say`Hello`; // read per call; identity changes on switch
store.subscribe((say) => {
  document.documentElement.lang = say.locale;
});
await store.set('fr'); // loads if needed; last switch wins; a failed load keeps the current view
```

A store exposes `say`, `set` and `subscribe` only; keep the catalogue for `locales`. Do not hold `const say = store.say` across a switch. When every locale is lazy, `await catalogue.load(initial)` at the top of the i18n module before building the store.

Server: no store. Look a view up per request with `catalogue.load(catalogue.match(guesses))`, splitting an `Accept-Language` header into its tags first (`header.split(',').map((s) => s.split(';')[0].trim())`), since `match` compares whole strings; views are safe to share between requests. For code that cannot be handed a view, `createScope(new AsyncLocalStorage())` from `saykit` gives a `scope.say` resolving to whatever `scope.run(view, fn)` established.

## React

### Client

```tsx title="src/main.tsx"
import { SayProvider } from '@saykit/react/client';
import { store } from './i18n';

<SayProvider store={store}>
  <App />
</SayProvider>;
```

```tsx title="src/locale-picker.tsx"
import { useSay } from '@saykit/react/client';
import { catalogue, store, type Locale } from './i18n';

export function LocalePicker() {
  const say = useSay(); // the current View; re-renders on switch
  return (
    <select value={say.locale} onChange={(event) => store.set(event.target.value as Locale)}>
      {catalogue.locales.map((locale) => (
        <option key={locale} value={locale}>
          {locale}
        </option>
      ))}
    </select>
  );
}
```

There is no store hook; the store is a module value, import it. `<SayProvider locale={locale} messages={messages}>` is the single-locale form a server hands across the boundary; it cannot switch.

### Server components

```ts title="src/i18n.ts"
import { createWithSay } from '@saykit/react/server';
import { createCatalogue } from 'saykit';
import en from './locales/en.po';
import fr from './locales/fr.po';

export const catalogue = createCatalogue({ en, fr });
export const withSay = createWithSay(catalogue);
```

```tsx title="app/[locale]/layout.tsx"
import { SayProvider } from '@saykit/react/client';
import { getSay } from '@saykit/react/server';
import { withSay } from '../../i18n';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getSay().locale}>
      <body>
        <SayProvider>{children}</SayProvider>
      </body>
    </html>
  );
}

export default withSay(Layout, (props) => props.params.then((params) => params.locale));
```

`withSay(Component, getLocale)` runs `getLocale` (returns a string, array, or nullish, sync or async), passes it through `catalogue.match`, loads the view and establishes it in React's per-request `cache()` before rendering. Wrap **every** layout and page that renders messages, not only the root: Next renders a page before its layout, so an unwrapped page's `getSay()` throws `'getSay' must be called below a 'withSay'`. `<SayProvider>` written in a server component takes no props; the `react-server` build serialises the established locale and messages to the client. `getSay()` is the server `useSay()`, for the locale as data or a string in a handler. `setSay(view)` establishes a view you resolved yourself. One view per request: a second locale replaces the first for everything rendered after it.

## Carbon

```ts
import { Client, Command, type CommandInteraction } from '@buape/carbon';
import { createWithSay, SayPlugin } from '@saykit/carbon';

export const withSay = createWithSay(catalogue);

class Ping extends withSay(Command) {
  constructor() {
    super((say) => ({ name: say`ping`, description: say`Ping the bot!` }));
  }

  async run(interaction: CommandInteraction) {
    await interaction.reply({ content: interaction.say`Pong!` });
  }
}

new Client(options, { commands: [new Ping()] }, [new SayPlugin(catalogue)]);
```

`withSay` builds command metadata once per locale. `interaction.say` is the interaction locale's view, `guild.say` the guild's.

## Workflow

1. Write or change a message.
2. `saykit extract` (or `saykit extract --watch`). Only the source locale file is written; other locales are created header-only and never touched afterwards.
3. Translate the other locales by hand or through a TMS. A locale file needs only the entries actually translated; the rest fall back through `fallbackLocales` to the source string at build time.
4. `saykit clean` when source strings were removed or reworded: it drops orphaned and empty entries from non-source locales and never adds anything.

Commit the catalogues. The `.d.*.ts` declarations are regenerated, commit or ignore them. CI check that extraction was run:

```yaml
- run: pnpm saykit extract
- run: git diff --exit-code -- 'src/locales/*'
```

Macros throw without the plugin, so a test runner needs it too; Vitest picks it up from `vite.config.ts`.

Custom formats: a `Formatter` is `{ extension: '.yaml', parse(content) => Message[], stringify(messages, meta) => string }` and a `Transformer` is `{ match(id) => boolean, extract(code, id) => Message[], transform(code, id) => string }`, where `Message` is `{ message, translation?, id?, context?, comments, references }`. See `examples/custom-formatter`.

## Errors

| Symptom                                                             | Cause and fix                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `'say' is a macro and must be used with the relevant saykit plugin` | The file was not transformed. Check the bucket `include` glob and that the plugin is in the bundler and test config |
| `Message for <id> is not a string`                                  | Stale or hand-written catalogue. Run `saykit extract`; import the file, never declare messages                      |
| `Messages for locale 'x' have not been loaded yet`                  | `catalogue.locale('x')` on a lazy locale. `await catalogue.load('x')` or `store.set('x')` first                     |
| `No messages for locale 'x'`                                        | `x` is not a key of the catalogue. Run guesses through `match` first                                                |
| `'getSay' must be called below a 'withSay'`                         | This segment is not wrapped. Wrap every layout and page, not only the root                                          |
| Edited a `.po`, dev server shows old strings                        | Babel `catalogues: 'inline'`. Use `'module'` with the Next or Metro `withSayKit`, or clear the cache                |
| Translator sees `{0}`                                               | Placeholder is not an identifier. Name it: `${{ name: value }}`                                                     |
| Build fails on a branch key such as `sold-out`                      | ICU keys are identifiers. Rename the discriminant at its source                                                     |
| `Text strings must be rendered within a <Text> component`           | React Native. `<Say whitespace={false}>`                                                                            |
