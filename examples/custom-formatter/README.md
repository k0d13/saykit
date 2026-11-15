# Custom formatter & transformer example

A Node CLI that prints a deploy summary, built entirely on **extension points**: a hand-written
YAML `Formatter` and a hand-written `Transformer` for a file type that is not JavaScript.

No `@saykit/format-*` or `@saykit/transform-jsx` package is involved in the interesting parts. If
you need SayKit to read a format it does not ship, or to pull messages out of a file type it has
never heard of, this is the example.

## What it demonstrates

| Concern                                                    | Where                  |
| ---------------------------------------------------------- | ---------------------- |
| A custom `Formatter` (`extension` / `parse` / `stringify`) | `yaml-formatter.ts`    |
| `existingContent`: not clobbering human edits              | `yaml-formatter.ts`    |
| `messageKey`: keying messages the way the runtime expects  | both files             |
| A custom `Transformer` (`match` / `extract` / `transform`) | `email-transformer.ts` |
| Compiling a **non-JS** file into a module                  | `email-transformer.ts` |
| Ambient types for the generated module                     | `src/templates.d.ts`   |
| Locale from `LC_ALL` / `LC_MESSAGES` / `LANG`              | `src/i18n.ts`          |

## Writing a formatter

```ts
interface Formatter {
  extension: `.${string}`;
  parse(content: string): Message[];
  stringify(messages: Message[], context: { locale: string; existingContent?: string }): string;
}
```

That is the whole contract. `Formatter` is a Zod schema in
[`@saykit/config`](../../packages/config/src/config/schema.ts), so a mistake in the shape is reported when
the config loads rather than halfway through an extraction run.

Two details are easy to get wrong, and this example is written to show both:

**Key messages with `messageKey`, not with the source text.** The transformer compiles the same
id into `say.call({ id })` at the call site, and that is what the runtime looks up. Keying on the
raw text instead produces a catalogue the runtime silently cannot read, and collides for two
messages with the same text but different `context`.

**Respect `existingContent`.** `stringify` is handed whatever is already on disk. Merge into it.
The YAML formatter here carries forward any existing `translation`, so re-running `saykit extract`
after a copy change does not wipe the other locales.

## Writing a transformer

```ts
interface Transformer {
  match(id: string): boolean;
  extract(code: string, id: string): Message[];
  transform(code: string, id: string): string;
}
```

`@saykit/transform-js` rewrites macros _inside_ JavaScript. Nothing requires that. The `.email`
transformer here owns a plain-text template format:

```
# Sent to the on-call engineer once a deploy finishes.
{actor} deployed {sha} to {environment}. {changed} files changed, {duration} elapsed.
```

`extract` lifts the body into a `Message` (with the `#` lines as translator comments), and
`transform` returns JavaScript:

```js
export default function render(say, values = {}) {
  return say.call({ id: 'a1b2c3d4', ...values });
}
```

By the time the bundler looks at the file, it _is_ a module, so `import summary from
'./templates/summary.email'` just works. TypeScript needs telling separately, which is what
`src/templates.d.ts` is for; the transformer runs in the bundler, long after the type-checker.

Note the generated function takes a view as a parameter instead of importing one. A template should
not decide which catalogue it belongs to, which keeps it compatible with the per-request
`catalogue.locale(locale)` the server examples use.

## Transformers compose

```ts
transformer: [js(), email()],
```

A bucket accepts an array. Each transformer declares what it owns via `match`, and a file is only
handed to the ones that claim it: `js()` takes `.ts`, `email()` takes `.email`. Extraction unions
their results; transformation pipes the file through each matching one in order.

## Importing them

`saykit.config.ts` picks both up relatively, straight off disk:

```ts
import email from './email-transformer.ts';
import yaml from './yaml-formatter.ts';
```

Note the `.ts`: the config is handed to the runtime as it sits, so specifiers are resolved by Node
and nothing rewrites the extension for you. That needs Node 22.18+ (or Bun, Deno, or `tsx`) to read
TypeScript. Bare specifiers work too, so a formatter you intend to reuse across projects can just as
well be a published package.

## Running it

```sh
pnpm install
pnpm --filter custom-formatter-example extract
pnpm --filter custom-formatter-example build
pnpm --filter custom-formatter-example start

LANG=fr_FR.UTF-8 pnpm --filter custom-formatter-example start   # in French
```

Further reading: the [custom formatter](../../website/content/guides/custom-formatter.mdx) and
[custom transformer](../../website/content/guides/custom-transformer.mdx) guides.
