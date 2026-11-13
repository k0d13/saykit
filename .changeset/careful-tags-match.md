---
'saykit': minor
---

Make `catalogue.match` case-insensitive and script-aware: guesses are canonicalised, then matched exactly, by language and script (`zh-HK` finds `zh-TW`), then by whole language subtag, so `fi` no longer matches `fil`
