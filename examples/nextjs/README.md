# Next.js example

A small coffee storefront on the Next.js App Router, localised with
[`@saykit/react`](../../packages/integration-react) and
[`babel-plugin-saykit`](../../packages/plugin-babel).

This is the example to read if you care about **React Server Components**: it renders messages on
the server _and_ in client islands, from a single catalogue serialised across the boundary exactly
once.

## What it demonstrates

| Concern                                                                                    | Where                                    |
| ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `withSay`, establishing the view for a route segment                                       | `layout.tsx`, `page.tsx`                 |
| `getSay()` inside a plain server component                                                 | `src/app/[locale]/product-card.tsx`      |
| `SayProvider` at the root, taking its props from the scope                                 | `src/app/[locale]/layout.tsx`            |
| `<Say>` in a **client** component                                                          | `add-to-cart.tsx`, `locale-switcher.tsx` |
| `generateStaticParams` from iterating a `Catalogue`, whose values are locale-bound `View`s | `src/app/[locale]/layout.tsx`            |
| Locale detection: path → cookie → `Accept-Language`                                        | `src/proxy.ts`                           |
| Babel wiring (Next.js runs Babel, not a bundler plugin)                                    | `.babelrc`                               |

## The server/client split

`@saykit/react` publishes its `.` entry twice and lets the bundler pick:

- In a **server** environment the `react-server` export condition resolves to a build where `<Say>`
  reads from `getSay()`, the view `withSay` put in React's request cache.
- In a **client** environment it resolves to the `"use client"` build, where `<Say>` reads from
  `useSay()`, the nearest `SayProvider`.

The component you write is identical in both cases:

```tsx
<Say>
  Roasted by <strong>{product.roaster}</strong>
</Say>
```

Because both halves are fed from the same view, with the client provider reading its locale and
messages straight off it, server output and client hydration cannot disagree about which locale is
active. Messages compile to data rather than to functions, so they cross the boundary as the JSON
they already are.

## Why `src/config.ts` exists separately

`src/i18n.ts` is marked `server-only` and imports all three catalogues. The middleware and the
locale `<select>` only need the _list_ of locale codes, so that lives in `src/config.ts` on its own.
Importing `i18n.ts` from either would drag the catalogues into the edge bundle and break the client
build.

## Babel, not unplugin

Next.js compiles with its own toolchain, so the macros are rewritten by `babel-plugin-saykit`:

```json
{ "presets": ["next/babel"], "plugins": ["saykit"] }
```

The plugin also rewrites `import en from './locales/en.js'` into an inline object. It requires a
**default** import for catalogue files and throws on a named one, which is the intended failure
mode, not a bug.

> Adding `.babelrc` opts the whole app out of Next.js's default SWC pipeline, which is slower to
> compile. Projects on a Vite-based framework should prefer `unplugin-saykit`; see the
> [TanStack Start example](../tanstack-start).

## Running it

```sh
pnpm install
pnpm --filter nextjs-example dev
pnpm --filter nextjs-example extract   # after editing any message
```

Visit `/` for English (served by rewrite), `/fr`, or `/pl`. The chosen locale is persisted in the
`x-preferred-locale` cookie, so a later visit to `/` redirects accordingly.

Further reading: the [Babel integration docs](../../website/content/integrations/babel.mdx) and the
[React integration docs](../../website/content/integrations/react.mdx).
