---
'unplugin-saykit': minor
'babel-plugin-saykit': minor
'@saykit/config': minor
---

Compile catalogues from the build plugins, so no `saykit compile` script is needed before dev or build. `unplugin-saykit` compiles when the build starts and recompiles in watch mode when a catalogue changes. For Next.js and Metro, wrap the config with `withSayKit` from `babel-plugin-saykit/next` or `babel-plugin-saykit/metro`, which compiles when the config loads and watches outside production. Unchanged modules are no longer rewritten, and writes are atomic so parallel workers never read a half-written module. `saykit compile` stays for setups without a plugin, such as plain Babel
