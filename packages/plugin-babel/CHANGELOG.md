# babel-plugin-saykit

## 0.11.0

### Patch Changes

- @saykit/config@0.11.0

## 0.10.0

### Patch Changes

- @saykit/config@0.10.0

## 0.9.1

### Patch Changes

- @saykit/config@0.9.1

## 0.9.0

### Patch Changes

- 70e4957: Ship smaller builds, keeping doc comments in the type declarations rather than the code
- da9fc02: Take `@babel/core` from the plugin API rather than as a dependency
- Updated dependencies [70e4957]
- Updated dependencies [e876c1e]
  - @saykit/config@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [08900e6]
- Updated dependencies [d9e5520]
  - @saykit/config@0.8.0

## 0.7.0

### Minor Changes

- a002ffc: Add `babel-plugin-saykit/next`, a `withSayKit` wrapper that derives the Turbopack and webpack catalogue rules from your SayKit config
- e7ccc52: Add a `catalogues: 'module'` option that hands catalogue assembly to `babel-plugin-saykit/next` or `babel-plugin-saykit/metro`, so editing a catalogue hot-reloads instead of requiring a cache-clearing restart

### Patch Changes

- 2a77e73: Resolve Metro's upstream transformer from the config's `projectRoot`, and invalidate its transform cache when `saykit.config.*` changes
- Updated dependencies [400a3f2]
- Updated dependencies [400a3f2]
- Updated dependencies [2a77e73]
  - @saykit/config@0.7.0

## 0.6.1

### Patch Changes

- Updated dependencies [7f5137f]
  - @saykit/config@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [30917de]
- Updated dependencies [06bee33]
  - @saykit/config@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [0fd3084]
- Updated dependencies [9a74035]
- Updated dependencies [ff0ff8d]
  - @saykit/config@0.5.0

## 0.4.1

### Patch Changes

- Updated dependencies [579023e]
- Updated dependencies [0571e96]
  - @saykit/config@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [ccaa461]
- Updated dependencies [326a4d9]
- Updated dependencies [0e96dec]
  - @saykit/config@0.4.0

## 0.3.0

### Minor Changes

- 299fc6c: Write extraction only to the source locale, add message fallbacks, and add a `clean` command.

  Extracted messages are now written to the source locale catalogue only, rather than to every locale. Other locales fall back to the source message when a translation is missing, keeping non-source catalogues focused on real translations. A new `clean` command removes generated catalogue output.

### Patch Changes

- Updated dependencies [299fc6c]
  - @saykit/config@0.3.0

## 0.2.0

### Minor Changes

- 60a8deb: Bump dependencies

### Patch Changes

- Updated dependencies [84550a2]
- Updated dependencies [60a8deb]
- Updated dependencies [44f6f29]
  - @saykit/config@0.2.0

## 0.1.0

### Minor Changes

- ba51e2f: First numbered release

### Patch Changes

- 7f680cd: Initial release
- d7101cb: Split babel transformers into separate transform-js and transform-jsx packages
- 292a0de: Add support for importing translation files directly
- Updated dependencies [ba51e2f]
- Updated dependencies [7520aa8]
- Updated dependencies [7f680cd]
- Updated dependencies [7b75d7c]
- Updated dependencies [d7101cb]
- Updated dependencies [292a0de]
  - @saykit/config@0.1.0
