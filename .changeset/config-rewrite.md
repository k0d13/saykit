---
'@saykit/config': major
---

Rewrite the package around two entry points, `@saykit/config` and `@saykit/config/messages`, replacing the `features/*` subpaths. `loadConfig({ cwd? })` finds, loads and validates `saykit.config.*` and returns the config with `compile`, `fileChanged`, `watch`, `extract`, `clean` and `transform` bound to it, so callers no longer thread it through loose functions. `defineConfig` is now a typed identity and no longer validates; `loadConfig` does, with readable errors, and accepts configs exported without it. Catalogue and output paths and include/exclude globs now resolve against the config's folder rather than the working directory, and references written by extraction are relative to it. Library calls are silent apart from failures; the CLI reports progress
