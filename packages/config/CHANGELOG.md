# @saykit/config

## 0.11.0

## 0.10.0

## 0.9.1

## 0.9.0

### Minor Changes

- e876c1e: Accept ICU skeletons as an argument style, so `{d, date, ::yyyyMMdd}` and `{n, number, ::currency/EUR}` format

### Patch Changes

- 70e4957: Ship smaller builds, keeping doc comments in the type declarations rather than the code

## 0.8.0

### Minor Changes

- 08900e6: Escape ICU's reserved characters in literal text, and write a plural or ordinal selector interpolated into its own branch as `#`
- d9e5520: Number a repeated placeholder expression once, so the same value written twice extracts as one placeholder rather than two

## 0.7.0

### Minor Changes

- 400a3f2: Add say.number, say.date, and say.time macros, and a plural offset
- 2a77e73: Export `resolveConfigFile` from `@saykit/config/features/loader`

### Patch Changes

- 400a3f2: Emit a numeric select branch key bare rather than failing the build, since ICU select has no exact-value syntax

## 0.6.1

### Patch Changes

- 7f5137f: Fail the build on a select, plural, or ordinal branch key ICU cannot express, rather than at format time

## 0.6.0

### Minor Changes

- 30917de: Add `say-tag` to name JSX placeholders, extract childless elements as self-closing tags, and compile message values behind an underscore so no name is reserved
- 06bee33: Reject two different values sharing a placeholder name, and allow a repeat when they are identical

## 0.5.0

### Minor Changes

- 0fd3084: Add a `messages` field to buckets for declaring catalogue entries that have no call site to extract from
- ff0ff8d: Load config files directly rather than transpiling them to a cache, fixing relative imports and `import.meta.dirname` — now requires Node 22.18+ or a runtime that reads TypeScript itself

### Patch Changes

- 9a74035: Update `commander`, `@commander-js/extra-typings`, and `js-sha256` to their latest majors

## 0.4.1

### Patch Changes

- 579023e: Stat globbed files instead of using `withFileTypes`, so extraction works under Bun's `node:fs/promises` shim.
- 0571e96: Load config files through the host runtime (Bun, Deno, tsx) or Node's type stripping when the TypeScript compiler API is unavailable

## 0.4.0

### Minor Changes

- ccaa461: Make `saykit clean` only remove orphaned and untranslated entries instead of prefilling locales with source keys.
- 326a4d9: Emit catalogue declarations as `{locale}.d.{extension}.ts` instead of `{locale}.{extension}.d.ts`.

  Delete any leftover `{locale}.{extension}.d.ts` files after upgrading; they are not migrated automatically, and a stale one will shadow the new declaration.

### Patch Changes

- 0e96dec: Stop an untranslated locale from displacing a translation resolved from its fallbacks.

## 0.3.0

### Minor Changes

- 299fc6c: Write extraction only to the source locale, add message fallbacks, and add a `clean` command.

  Extracted messages are now written to the source locale catalogue only, rather than to every locale. Other locales fall back to the source message when a translation is missing, keeping non-source catalogues focused on real translations. A new `clean` command removes generated catalogue output.

## 0.2.0

### Minor Changes

- 84550a2: Stop auto-generating a `.gitignore` next to catalogue files. SayKit no longer writes or overwrites a `.gitignore` in the output directory, leaving it to you to decide which generated files (e.g. `*.d.ts` locale declarations) to commit or ignore. This makes it possible to commit declaration files so CI can type-check without an extra extraction step.
- 60a8deb: Bump dependencies
- 44f6f29: Add a `whitespace` prop to `<Say>` for controlling whitespace-only text nodes in the rendered output.

  When multiple elements sit inside a `<Say>` (e.g. two `<Text>` children), the literal whitespace between them is preserved in the compiled output as a bare string node. This is fine on the web, but stricter environments like React Native error when a string is rendered outside of a text component.

  Set `whitespace={false}` to drop whitespace-only text nodes from the rendered result:

  ```tsx
  <View>
    <Say whitespace={false}>
      <Text>Hello</Text>
      <Text>World</Text>
    </Say>
  </View>
  ```

  The default remains `true`, preserving existing (web-compatible) behaviour.

## 0.1.0

### Minor Changes

- ba51e2f: First numbered release

### Patch Changes

- 7520aa8: Replace `sourceLocale` config option with only first locale in `locales`
- 7f680cd: Initial release
- 7b75d7c: Make formatter a required option for config bucket
- d7101cb: Split babel transformers into separate transform-js and transform-jsx packages
- 292a0de: Add support for importing translation files directly
