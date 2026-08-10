---
name: fix-queue
description: "Open TODOs for the migration tooling, priority-ordered. Done items get DELETED, not struck through."
updated: 2026-08-10
---

1. Teach `convert.py` to rewrite intra-wiki links to site-relative URLs (currently
   left as dead wiki links — found by R. in PR #14 review).
2. Add a CI check that every migrated page has a `source:` frontmatter line pointing
   at its wiki original.
