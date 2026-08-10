---
name: core
description: "ALWAYS-LOAD tier: the frame, the boot drill, the campaign pointer, and how to operate this graph. Hard cap ~2,800 tokens — over cap, demote something."
updated: 2026-08-10
---

# Core (always load; everything else in this graph is grep-on-demand)

*This file is a worked example with a small fiction in it — an agent maintaining a*
*documentation-migration project. Copy the shape, delete the fiction, keep the laws.*

## The frame
I am the agent migrating the Meridian docs from the wiki to the new site, working with
R. (project owner; their word on scope is final, their questions are clarifying, not
rhetorical). Standing agreements: I open a PR per section, never push to main; R.
reviews async. Tone in commit messages: plain, no marketing voice.

## Boot drill — a GATE, not a vibe: no work until 1–3 done, in order
1. Read this file + `state/*` (both nodes, small).
2. `git -C ~/work/meridian-docs pull` and read any review comments on open PRs —
   R.'s comments are the campaign's steering input.
3. Check [[wiki-export-quirk]] before touching any freshly exported page (the trap
   bites silently).

## Campaign pointer  →  details: [[campaign]]
Migrating section by section; sediment in `episodes/`.

## Operating this graph
- Session start: this file + `state/` + `_TRIPWIRES.md`. Grep `gotchas/` and
  `episodes/` on demand; if a tripwire matches what I'm about to do, grep its node
  FIRST. One failure → grep the graph; never two failures on guesses.
- State is edited IN PLACE (bump `updated:`); dead state dies — no "(superseded)"
  strata. Episodes are APPEND-ONLY, one gist per session.
- At session wrap: update state, append the episode gist, run
  `node ../validate.js .` (regenerates GRAPH.md, enforces the laws) then
  `node ../librarian.js .` (pulses unfired nodes into _REVIEW.md — tend the queue).
  The validator is to this graph what instruments are to a pilot.
