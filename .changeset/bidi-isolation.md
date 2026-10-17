---
'saykit': patch
'@saykit/react': patch
---

Add a `bidiIsolation` option to `createCatalogue` and `createView`, so `'none'` can keep substituted values such as Discord mentions free of bidi isolation marks, and carry a view's options across the React server/client boundary
