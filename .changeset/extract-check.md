---
'@saykit/config': minor
---

Add `saykit extract --check` for CI, which extracts in memory, writes nothing, and exits non-zero listing the messages that would be added, removed or updated in each out-of-date catalogue. `--untranslated` and `--orphaned` also fail on non-source locales with untranslated messages or entries `clean` would remove. The same check is available as `config.check()`
