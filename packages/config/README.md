# @saykit/config

> Configuration schema and CLI for [SayKit](https://saykit.js.org).

[![Coverage](https://codecov.io/gh/k0d13/saykit/graph/badge.svg?flag=config)](https://codecov.io/gh/k0d13/saykit?flags%5B0%5D=config)

Provides the `defineConfig` helper, `loadConfig` for build tools, and the `saykit` CLI that extracts messages from your source and compiles catalogues into the modules your app imports.

## Install

```sh
pnpm add -D @saykit/config
```

## Configuration

```ts title="saykit.config.ts"
import { defineConfig } from '@saykit/config';
import po from '@saykit/format-po';
import js from '@saykit/transform-js';

export default defineConfig({
  locales: ['en', 'fr'],
  // Optional per-locale fallback chains, most specific first. The source locale
  // (the first entry in `locales`) is always the final fallback.
  fallbackLocales: {
    'en-NZ': ['en-GB'],
    'es-MX': 'es',
  },
  buckets: [
    {
      include: ['src/**/*.ts'],
      output: 'src/locales/{locale}.{extension}',
      formatter: po(),
      transformer: js(),
    },
  ],
});
```

## CLI

```sh
saykit extract           # extract messages once
saykit extract --watch   # extract and watch for changes
saykit extract --check   # fail if extraction would change a catalogue, for CI
saykit compile           # compile catalogues to {locale}.js modules
saykit clean             # prune dead entries from other locales
```

Extraction only writes the **source** locale (the first entry in `locales`). Locales that don't
have a file yet are bootstrapped with an empty, header-only catalogue so a TMS can register them;
existing translation files are left untouched. Translated content is owned by your TMS.

`saykit compile` (which `extract` also runs) writes a `{locale}.js` beside each catalogue, filled
from its fallback chain so an untranslated key resolves to a fallback locale and ultimately the
source string. The build plugins compile too, when they start and in dev on every catalogue
change, so `saykit compile` is only for setups without one, such as plain `babel`. Ignore the `.js`
modules in git; commit the `{locale}.d.ts` beside them.

`saykit clean` only ever subtracts from non-source locales: it drops entries that no longer exist in
the source catalogue and entries with an empty translation, and leaves everything else exactly as it
is. It never adds source keys to a locale file, that stays your TMS's job.

`saykit extract --check` extracts in memory and writes nothing. It exits with 1 and lists the
messages that would be added (`+`), removed (`-`) or updated (`~`) when the source catalogue is out
of date, or when a locale file would be created. Two flags make it stricter for non-source locales:

- `--untranslated` fails on source messages a locale has no translation for, whether missing, empty
  or fuzzy
- `--orphaned` fails on entries the source no longer has, the ones `clean` would remove

## Programmatic use

`defineConfig` is a typed identity; `loadConfig` finds `saykit.config.*` in `cwd`, validates it and returns the config with its operations. Relative paths in the config resolve against the config's folder.

```ts
import { loadConfig } from '@saykit/config';

const config = loadConfig();
config.compile(); // every bucket and locale, skipping unchanged writes
config.fileChanged(path); // a catalogue changed: recompile what reads it
config.watch(); // recompile on catalogue changes, returns a stop function
await config.extract({ watch: false });
await config.check({ untranslated: true, orphaned: true }); // out-of-date catalogues, [] when none
config.clean();
config.transform(code, file); // undefined when no bucket includes the file
```

The message IR for transform authors lives in `@saykit/config/messages`.

## Documentation

Full configuration guide and CLI reference at [saykit.js.org](https://saykit.js.org).
