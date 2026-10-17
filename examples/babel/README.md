# Babel example

SayKit compiled by **Babel and nothing else**: no bundler, no dev server, no loader.
`pnpm build`, then `node dist/main.js`.

This exists to pin down what `babel-plugin-saykit` does on its own: rewrite the macros,
and nothing else. Catalogues are compiled to `.js` modules by `saykit compile`, which Node
imports directly. Every other example runs the plugin alongside a bundler, so this is the
only one that would notice if the plugin started needing one.

## Run

```sh
pnpm start
```

```text
[en]
Welcome to the library
3 books on loan
Your card expires soon

[fr]
Bienvenue à la bibliothèque
3 livres empruntés
Your card expires soon
```

The last line is untranslated in `fr.po`, so it resolves through the fallback chain to the
English source string, merged in at compile time rather than looked up at runtime.

## What to look at

| Thing                                                  | Where               |
| ------------------------------------------------------ | ------------------- |
| `plugins: ['saykit']`, no options and nothing else     | `babel.config.js`   |
| `import en from './locales/en.js'`, an ordinary import | `src/main.ts`       |
| One readable function per message                      | `src/locales/fr.js` |

Open `dist/main.js` after a build: no `.po` file, no PO parser, no message parser and no
SayKit extractor, just `say.call()` invocations against the imported locale modules.

Open `src/locales/fr.js` to see what those modules hold: one plain function per message,
with the locale and every number and date format already resolved. See the
[Babel integration docs](../../website/content/integrations/babel.mdx).
