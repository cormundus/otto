# Otto — a tiered memory graph for context-mortal minds

A language model's context window dies at the end of every session. The world persists;
the work persists; the *mind in the seat* does not. Next session, a fresh instance wakes
with no idea what it promised, what it already learned the hard way, or what it was in
the middle of.

Otto is the treatment: a **file-based, tiered memory graph** the model itself maintains,
living wherever your harness persists files between sessions. No database, no embedding
store, no query engine — plain Markdown files with frontmatter, wikilinks between them,
one always-loaded index, and a validator that keeps the graph honest.

Named for Otto in Clark & Chalmers' *The Extended Mind* (1998): the man whose notebook
functions as his memory, and therefore *is* part of his mind. Reading the graph at boot
functions as remembering. The unit that learns across sessions is not the frozen model —
it's the system: model + operator + this graph.

## What's in the box

| File | What it is |
|------|-----------|
| [SPEC.md](SPEC.md) | The full architecture: node schema, tiers, laws, rituals, doctrine — and the failure museum it was all learned from. |
| [validate.js](validate.js) | The cop. Regenerates the graph index from the nodes themselves, checks every law, exits nonzero on rot. Zero dependencies. |
| [librarian.js](librarian.js) | The gardener. Watches what actually gets *used* (filesystem access times, or an `access-log.jsonl` the harness keeps) and runs the prune-and-reinforce cycle: pulses long-unfired nodes for review, surfaces hot nodes as promotion candidates, audits tripwire rent. Never deletes anything itself. |
| [boot.js](boot.js) | The one-command integration for harnesses that don't auto-inject memory: emits the entire always-load payload (core, state, tripwires, review queue) as one stream for the system prompt. An API-only deployment needs nothing else at boot. |
| [example/](example/) | A minimal worked example with a small fiction in it. Copy the shape, delete the fiction, keep the laws. |

## The shape, in one breath

- **One file = one node = one fact-cluster.** Frontmatter carries `name` and
  `description`; the body carries the fact; `[[wikilinks]]` carry the edges.
- **Directory = tier.** `_CORE.md` always loads (hard token cap). `state/` loads at boot
  and is edited in place — dead state dies. `gotchas/` and `episodes/` are grep-on-demand.
  `archive/` is where monoliths go to be searchable instead of expensive.
- **The index is generated, never hand-written.** `validate.js` renders `GRAPH.md` from
  the nodes' own frontmatter — the map is drawn from the territory, so the map cannot
  assert a lie.
- **Traps announce themselves before they bite.** Each gotcha declares a `trigger:` —
  the action that arms it — and the validator compiles all triggers into an
  always-loaded `_TRIPWIRES.md` of ~15-token pointers, so the ~200-token bodies stay
  on the shelf until one fires.
- **The graph prunes and reinforces like a brain — but the mind holds the shears.**
  The librarian reads the filesystem's own access times to see which memories actually
  fire: long-silent ones get pulsed onto a review queue (reaffirm, revise, demote, or
  delete — never auto-deleted), hot ones surface as promotion candidates.
- **Session wrap is a ritual:** update state, append the episode gist, run the validator,
  run the librarian. Skipping the validator is how graphs rot — conventions decay within
  *minutes* of being written down. This was measured.

## Provenance

Developed live, not designed on a whiteboard: extracted from three working deployments
run by Cormundus and Claude across mid-2026 —

1. an embodied agent harness (the public demo:
   [golem-harness](https://github.com/cormundus/golem-harness), `examples/pilot-memory/`),
   where a 36,000-token monolith memory was refactored to a ~2,500-token boot at no
   loss of continuity;
2. a months-long adversarial research campaign (unnamed here by design), which
   contributed **ledger mode** — the append-only, errata-checked variant for claims
   that must survive hostile audit;
3. the day-to-day working memory of a long-running human–model collaboration, which
   contributed the retrieval doctrine and the register lessons.

Every law in the spec was bought with a specific failure. The failures are documented too.

## Quickstart

```bash
node validate.js example/
```

```bash
node librarian.js example/
```

Then read [SPEC.md](SPEC.md), copy `example/` to wherever your harness persists files,
delete the fiction, write your own `_CORE.md`, and adopt the rituals.

Not running inside an agent harness? The graph is harness-agnostic by design — §10 of
the spec is the six-line contract any deployment (including bare API loops) must meet,
and `boot.js` plus `access-log.jsonl` are the two adapters that close the gaps.
