# saykit

## 0.11.0

### Patch Changes

- 1092130: Remove Catalogue.Options, createCatalogue takes Record<Locale, Catalogue.Source> directly
- b6ac149: Format a lone `say.date`, `say.number`, `say.time` or `<Say.Date />` directly instead of extracting it, since it carries nothing a translator can change

## 0.10.0

### Minor Changes

- 55719ed: Add `createStore`, which holds the current view and switches locale, and replace the catalogue's `loader` with a thunk per locale
- e1509d9: Replace the `Say` class with a catalogue that owns the locales and immutable per-locale views that format
- 7de7816: Add `createScope`, which resolves the view the work running right now is saying things in, over an `AsyncLocalStorage` on a server or one variable in a browser
- 5bd6473: Take a record of messages keyed by locale in `createCatalogue`, dropping `locales` and `defaultLocale`: the keys are the locales and the first is the fallback `match` resolves to

## 0.9.1

## 0.9.0

### Minor Changes

- e876c1e: Accept ICU skeletons as an argument style, so `{d, date, ::yyyyMMdd}` and `{n, number, ::currency/EUR}` format

### Patch Changes

- 70e4957: Ship smaller builds, keeping doc comments in the type declarations rather than the code

## 0.8.0

### Minor Changes

- 08900e6: Escape ICU's reserved characters in literal text, and write a plural or ordinal selector interpolated into its own branch as `#`

## 0.7.0

### Minor Changes

- 400a3f2: Add say.number, say.date, and say.time macros, and a plural offset

## 0.6.1

## 0.6.0

### Minor Changes

- 90296f6: Compile message values behind an underscore so a value named `id` no longer displaces the message id
- 90296f6: Name a placeholder by interpolating a single-key object, `${{ cartTotal: getTotal() }}`

## 0.5.0

## 0.2.1

## 0.2.0

## 0.1.0

### Minor Changes

- ba51e2f: First numbered release

### Patch Changes

- 7f680cd: Initial release
