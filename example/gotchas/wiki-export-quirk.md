---
name: wiki-export-quirk
description: "Migrated page renders with mojibake / broken tables → the wiki exporter emits UTF-8 with BOM and CRLF; strip BOTH before conversion, recipe inside"
trigger: "about to run convert.py on (or commit) a freshly exported wiki page"
---

Symptom: a freshly migrated page renders fine locally but shows mojibake on the first
table row in CI, or the table renders as a paragraph.

Cause: the wiki's export endpoint emits UTF-8 **with BOM** and CRLF line endings. The
markdown table parser treats the BOM as body text on line 1.

Fix, before running `convert.py` on any fresh export:

    sed -i '1s/^\xEF\xBB\xBF//' page.md && dos2unix page.md

Bit us on the API Reference export (see [[ep-2026-08-09]]). The exporter cannot be
configured otherwise — checked the docs and the admin panel, 08-09.
