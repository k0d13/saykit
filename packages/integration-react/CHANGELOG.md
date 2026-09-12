# @saykit/react

## 0.11.0

### Minor Changes

- b873167: Replace `<SayScope>` with `createWithSay` and `setSay` on the server, so a route segment establishes its own view instead of inheriting one from a parent that may not have rendered yet

### Patch Changes

- b6ac149: Format a lone `say.date`, `say.number`, `say.time` or `<Say.Date />` directly instead of extracting it, since it carries nothing a translator can change

## 0.10.0

### Minor Changes

- 588f32e: Follow a store from `SayProvider`, and replace the server helpers with `<SayScope>` and `getSay`
- e1509d9: Replace the `Say` class with a catalogue that owns the locales and immutable per-locale views that format

### Patch Changes

- 55719ed: Add `createStore`, which holds the current view and switches locale, and replace the catalogue's `loader` with a thunk per locale

## 0.9.1

## 0.9.0

### Patch Changes

- 70e4957: Ship smaller builds, keeping doc comments in the type declarations rather than the code

## 0.8.0

### Minor Changes

- 08900e6: Escape ICU's reserved characters in literal text, and write a plural or ordinal selector interpolated into its own branch as `#`

## 0.7.0

### Minor Changes

- 400a3f2: Add say.number, say.date, and say.time macros, and a plural offset

## 0.6.1

### Patch Changes

- 1a0b9d6: Accept named placeholders as `Say` children

## 0.6.0

### Minor Changes

- 90296f6: Compile message values behind an underscore so a value named `id` no longer displaces the message id
- 30917de: Add `say-tag` to name JSX placeholders, extract childless elements as self-closing tags, and compile message values behind an underscore so no name is reserved

### Patch Changes

- 6948695: Rebuild the `SayProvider` instance when the locale or messages change so locale switches reach descendants

## 0.5.0

## 0.2.1

### Patch Changes

- ec1c06d: Ship the default entry as `dist/index.mjs` rather than `dist/index.client.mjs`.

## 0.2.0

### Minor Changes

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

### Patch Changes

- saykit@0.2.0

## 0.1.0

### Minor Changes

- ba51e2f: First numbered release

### Patch Changes

- 7f680cd: Initial release
- d7101cb: Split babel transformers into separate transform-js and transform-jsx packages
- Updated dependencies [ba51e2f]
- Updated dependencies [7f680cd]
  - saykit@0.1.0
