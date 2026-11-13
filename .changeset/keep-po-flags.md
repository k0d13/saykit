---
'@saykit/config': minor
'@saykit/format-po': minor
---

Read PO flags on parse and carry them on `Message`, so ones a translation tool writes, like `fuzzy`, survive when SayKit rewrites a catalogue, and treat a `fuzzy` translation as untranslated on compile, falling back as gettext does
