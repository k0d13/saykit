# @saykit/transform-jsx

## 0.11.0

### Patch Changes

- b6ac149: Format a lone `say.date`, `say.number`, `say.time` or `<Say.Date />` directly instead of extracting it, since it carries nothing a translator can change
- Updated dependencies [b6ac149]
  - @saykit/transform-js@0.11.0
  - @saykit/config@0.11.0

## 0.10.0

### Patch Changes

- @saykit/config@0.10.0
- @saykit/transform-js@0.10.0

## 0.9.1

### Patch Changes

- 4f2b3a9: Extract `// TRANSLATORS:` comments from where they are actually written — above a statement, above a selector or argument call, and as a `{/* … */}` child in JSX
- Updated dependencies [4f2b3a9]
  - @saykit/transform-js@0.9.1
  - @saykit/config@0.9.1

## 0.9.0

### Patch Changes

- 70e4957: Ship smaller builds, keeping doc comments in the type declarations rather than the code
- Updated dependencies [70e4957]
- Updated dependencies [e876c1e]
  - @saykit/config@0.9.0
  - @saykit/transform-js@0.9.0

## 0.8.0

### Minor Changes

- 6d725a6: Extract JSX whitespace exactly as JSX renders it, and read a literal expression child such as `{' '}` or `{10}` as the text it renders as
- 08900e6: Escape ICU's reserved characters in literal text, and write a plural or ordinal selector interpolated into its own branch as `#`

### Patch Changes

- Updated dependencies [08900e6]
- Updated dependencies [d9e5520]
  - @saykit/config@0.8.0
  - @saykit/transform-js@0.8.0

## 0.7.0

### Minor Changes

- 400a3f2: Add say.number, say.date, and say.time macros, and a plural offset

### Patch Changes

- Updated dependencies [400a3f2]
- Updated dependencies [400a3f2]
- Updated dependencies [2a77e73]
  - @saykit/config@0.7.0
  - @saykit/transform-js@0.7.0

## 0.6.1

### Patch Changes

- 7f5137f: Fail the build on a select, plural, or ordinal branch key ICU cannot express, rather than at format time
- 3e2273e: Stop JSX extraction inserting a space before punctuation stranded at the start of a line.
- Updated dependencies [7f5137f]
  - @saykit/config@0.6.1
  - @saykit/transform-js@0.6.1

## 0.6.0

### Minor Changes

- 30917de: Add `say-tag` to name JSX placeholders, extract childless elements as self-closing tags, and compile message values behind an underscore so no name is reserved
- 90296f6: Name a placeholder by interpolating a single-key object, `${{ cartTotal: getTotal() }}`
- 06bee33: Reject two different values sharing a placeholder name, and allow a repeat when they are identical

### Patch Changes

- c6b374e: Add JSX message source references to parser
- Updated dependencies [90296f6]
- Updated dependencies [30917de]
- Updated dependencies [90296f6]
- Updated dependencies [06bee33]
  - @saykit/transform-js@0.6.0
  - @saykit/config@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [0fd3084]
- Updated dependencies [9a74035]
- Updated dependencies [ff0ff8d]
  - @saykit/config@0.5.0
  - @saykit/transform-js@0.5.0

## 0.4.1

### Patch Changes

- Updated dependencies [579023e]
- Updated dependencies [0571e96]
  - @saykit/config@0.4.1
  - @saykit/transform-js@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [ccaa461]
- Updated dependencies [326a4d9]
- Updated dependencies [0e96dec]
  - @saykit/config@0.4.0
  - @saykit/transform-js@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [299fc6c]
  - @saykit/config@0.3.0
  - @saykit/transform-js@0.3.0

## 0.2.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [84550a2]
- Updated dependencies [60a8deb]
- Updated dependencies [44f6f29]
  - @saykit/config@0.2.0
  - @saykit/transform-js@0.2.0

## 0.1.0

### Minor Changes

- ba51e2f: First numbered release

### Patch Changes

- d7101cb: Split babel transformers into separate transform-js and transform-jsx packages
- Updated dependencies [ba51e2f]
- Updated dependencies [7520aa8]
- Updated dependencies [7f680cd]
- Updated dependencies [7b75d7c]
- Updated dependencies [d7101cb]
- Updated dependencies [292a0de]
  - @saykit/transform-js@0.1.0
  - @saykit/config@0.1.0
