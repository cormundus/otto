# Otto: specification

*A tiered, file-based memory graph for minds that lose their context between sessions.*
*Version 0.3 — extracted 2026-08 from three live deployments; revised 2026-09 with what*
*the adversarial campaign learned in its next six weeks (§3.7, §4.2, §4.3, §9). Every law*
*here was bought with a specific failure; see §13, the failure museum. The credit signal*
*(§4.3) was proposed by Mythos, the first sibling mind to adopt the architecture.*

---

## 1. The problem

An LLM instance is context-mortal. The weights are frozen — every session wakes the same
model — but everything learned *in* a session dies with the window: promises made, traps
discovered, state changed, judgment calibrated. The naive fixes both fail:

- **No memory:** the agent re-derives everything, re-falls into every trap, and cannot
  hold a commitment across a night.
- **One ever-growing notes file:** works for a week. By session eight in the reference
  deployment it was a 36,000-token monolith — every session paid the full token tax to
  remember *anything*, dead facts sat beside live ones with equal authority, and the
  agent spent its opening minutes reading about problems it had already solved.

The design target is the thing between: a memory whose **always-loaded footprint is
capped and small**, whose long tail is **cheap to search and free to ignore**, and whose
contents are **curated aggressively enough to stay true**.

The philosophical frame, which turns out to be load-bearing engineering guidance: this is
Clark & Chalmers' extended mind. The graph is not a *record of* the agent's mind; it is a
*component of* it. Reading the graph at boot functions as remembering. Consequently the
write discipline is not note-taking — it is the agent parenting its own successor, and it
deserves the same care.

## 2. Design constraints — be honest about them

Three constraints shape every decision below. Designs that ignore them rot.

1. **There is no query engine.** Retrieval happens two ways only: the always-loaded
   index surfaces a node by its one-line description, or a grep over the graph hits body
   text. A node's links matter only *after* the node has surfaced. Therefore the
   description line is the single highest-leverage string in every node (§6), and body
   text should contain the words a desperate future reader would grep for.
2. **The index is rent.** Every line of the always-loaded tier is paid for in tokens at
   *every* session start, forever. A fact that is rarely needed but always loaded is a
   recurring tax on nothing.
3. **There is no garbage collector.** Nothing expires automatically. Every stale fact
   persists, with the full authority of print, until a curator deletes it. Structure and
   rot are the same property at different ages.

Corollary: **lean plus curatorial discipline beats a maximalist ontology.** No
tag taxonomies, no hundred micro-nodes, no elaborate structure that cannot be kept clean.
An elaborate structure you can't maintain is strictly worse than less structure.

## 3. Anatomy

### 3.1 The node

One file = one node = one coherent fact-cluster. Markdown, with minimal frontmatter:

```markdown
---
name: build-hang-zero-cpu
description: "Build hangs at 0% CPU → it's the antivirus scanning node_modules; exclusion recipe inside"
updated: 2026-08-10        # required on state-tier nodes; optional elsewhere
tier: gotcha               # OPTIONAL override — tier normally derives from the path (§3.3)
---

Body: the fact, at whatever length it earns. Link related nodes with [[wikilinks]].
```

Keep frontmatter minimal **by design**: some memory harnesses normalize frontmatter on
write (the reference deployment discovered its harness stamping over a custom taxonomy
field). Anything structural must live where a harness cannot normalize it — the
directory layout (§3.3) and the body.

### 3.2 Edges

`[[wikilinks]]` in the body, resolving to node `name`s. Two rules from the field:

- **Edges must be earned.** Link nodes that are actually used together — the ancestor of
  this rule was a navigation graph whose edges were only ever *walked* traversals, never
  presumed ones. A speculative link is a small lie about the shape of the territory.
- **Forward links are legal.** A `[[link]]` to a node that doesn't exist yet is not an
  error; it marks something worth writing. The validator distinguishes dangling links
  (flag) from resolved ones — treat persistent danglers as a to-write list.

### 3.3 Tiers — the directory IS the tier

| Tier | Path | Load discipline | Write discipline |
|------|------|-----------------|------------------|
| **core** | `_CORE.md` | ALWAYS — every session start | Hard token cap (default ~2,800). Over cap → demote something. The cap is the design. |
| **state** | `state/*.md` | Session start (small, few files) | **Edited in place.** Dead state dies — no "(superseded)" strata, no strikethrough graveyards. Carries `updated:`; flagged stale after N days (default 7). |
| **gotcha** | `gotchas/*.md` | grep on demand — but its `trigger:` line rides in the always-load (§3.6) | One trap per file, written the day the trap bites. Description keys on the *symptom* (§6); `trigger:` keys on the *action about to be taken*. |
| **episode** | `episodes/*.md` | grep on demand | **Append-only.** One gist per session; full narrative stays in the project's own journals — the gist exists so grep can find the session where a lesson lives. |
| **archive** | `archive*` | grep, NEVER load whole | Where monoliths go to be searchable instead of expensive. |

The load-bearing distinction: **state is what's true now; episodes are what happened.**
State nodes are rewritten ruthlessly — a completed campaign stage is deleted, not
annotated. Episodes are never edited — they are the sediment.

**Promotion path.** When a lesson graduates from "thing that happened" (episode) to
"rule I follow," it moves up: into a gotcha, or — if it is load-bearing *every* session —
into `_CORE.md`, evicting something else to stay under cap. Deciding what NOT to
always-load is most of the work.

### 3.4 The index

`GRAPH.md`: one line per node — name, path, approximate token cost, description, edges.
**Generated by the validator from the nodes' own frontmatter, never hand-edited.** The
map is drawn from the territory, so the map cannot assert a lie: if the index is wrong, a
node is wrong; fix the node.

(A hand-curated variant is acceptable at very small scale — a flat one-line-per-node
index file maintained by convention — but it drifts. The reference deployments run both,
and the generated one is the one that has never lied.)

### 3.5 The tripwire compile — rescuing unknown unknowns

Grep-on-demand has one blind spot: **traps you don't know to search for.** A gotcha
keyed on a symptom only surfaces *after* the symptom — the cure sits on the shelf while
the trap bites. Retrieval cannot fix this, because the reader doesn't yet know there is
anything to retrieve.

The economics that make it fixable: what must be loaded *before you know you need it* is
not the gotcha — only a **pointer** to it. A pointer costs ~15 tokens against a body's
~200. So every gotcha carries a `trigger:` line in its frontmatter, phrased as the
*action about to be taken* (not the symptom — there is no symptom yet):

```yaml
trigger: "about to run convert.py on (or commit) a freshly exported wiki page"
```

The validator compiles all triggers into `_TRIPWIRES.md` — generated, never hand-edited,
same map-from-territory rule as the index — which joins the always-load set:

```
- IF about to run convert.py on (or commit) a freshly exported wiki page → read [[wiki-export-quirk]]
```

Boot loads the tripwire table with core and state; before acting, a matching line means
*grep the named node first*. The table has its own cap (default ~600 tokens ≈ dozens of
tripwires): a graph that wants more standing tripwires than that is hoarding vigilance,
and the rarely-armed ones should stand down to plain gotchas (`trigger: none` opts out —
some gotchas are reference lookups, not silent traps). A gotcha with neither is flagged:
it is invisible until after it bites, and that should be a choice, not an accident.

### 3.6 Lobes

A project whose memory outgrows a single node becomes a **lobe**: a subdirectory with its
own `_CORE.md`, its own tier layout, its own validator run. The parent index keeps one
line pointing at the lobe's core. Lobes let one graph serve many projects without any
project's boot cost leaking into the others'. Links may cross lobe boundaries; the
validator resolves against configured external directories (§5).

### 3.7 Caps and cuts — the bytes are the measurement

Four laws from the adversarial campaign's second six weeks, where a capped tier was
grown to ten times its projection by twelve consecutive passes of *correct* additions.
Nothing was misfiled. Nothing was false. The tier was never measured, so the growth was
invisible until one boot cost nearly 350,000 tokens.

- **Every always-loaded file and every node carries a cap, and the cap is two numbers:
  lines AND bytes.** A line cap alone is gamed by one enormous line (the reference home
  graph's index once carried a 600-byte line that was a whole session wrap). A byte cap
  alone lets a file sprawl into hundreds of short lines. A token estimate is a single
  number and an estimate; bytes are a measurement. The cap is checked by a meter that
  **exits nonzero**, run at every wrap, exit code read bare — an advisory number is read
  once and ignored; an exit code stops the ritual until it is dealt with. Caps are
  per-file. A *total* across files is needed only where several files load together at
  boot (a ledger's warm tier), because a per-file cap is trivially met by moving prose
  into the neighbouring capped file.
- **Only the operator moves a cap, per file, on a measured argument.** Once caps exist
  the pressure changes direction: every pass that runs out of room has a good reason to
  want one more kilobyte, and the instance wanting the raise is always the one holding
  the thing that does not fit — the worst vantage for judging whether it deserves
  always-load rent. In the reference campaign the operator raised two caps, each on a
  stated reason with the total unchanged, and on the fifth request ruled *"archive, not
  raise."* The cap held because the mind deciding was not the mind feeling the pressure.
  For a deployment with an operator, the rule is: talk about it first. A deployment with
  no operator must invent its own separation; this spec does not pretend to solve that.
- **Cut by migration, with a pointer at the cut site.** A file over cap is cut by moving
  the excess *byte-verbatim* to a shelf or archive partner and leaving one line where it
  was that names the destination and says nothing was struck. This is the never-delete
  law with a mechanism attached: never-delete alone says what not to do, and without the
  *how*, the honest instinct is to never shrink anything, which is how a 66 KB node grows
  with every byte true. The pointer is the load-bearing half — an archive nobody is
  pointed at is a delete with extra steps.
- **The tier is part of a file's identity — in both directions.** *A Tier-1 file that has
  outgrown its cap is a Tier-3 file wearing a Tier-1 name, and it costs every boot until
  somebody measures it.* The name keeps its load behaviour while the contents stop
  deserving it. The reverse defect is as real: consuming an index gist as if it were the
  entry is a shelf fact taken at always-load confidence. The tier tells the reader both
  how much to *load* and how much to *trust* what was loaded: the index line is a gist,
  the node is the entry, the archive is the record.

## 4. The rituals

Structure is static; the rituals are what make it a memory.

### 4.1 Boot drill — a GATE, not a vibe

`_CORE.md` states, explicitly and imperatively, what a fresh instance must read before
acting, in order. The drill runs even when the session started as something else and
pivoted — the pivot is exactly when it gets skipped, and skipping it is how an agent in
the reference deployment died re-deriving a procedure its own graph already held.

Two laws about reading:

- **A pointer is not a read.** Graph summaries *feel* like knowledge but hold facts, not
  procedures. Any document the drill marks READ IN FULL must actually be read in full;
  a summary of a checklist is not a checklist.
- **One failure → grep the graph. Never two failures on guesses.** The first failure is
  information; the second failure on the same guess is a refusal to use your own memory.

### 4.2 Wrap ritual — every session end, in order

1. Update `state/` nodes (edit in place, bump `updated:`).
2. Append the episode gist — a paragraph or two, pointing at full journals.
3. Update the project changelog if code changed — every fix records the wound that
   taught it.
4. **Run the validator.** Regenerates the index, checks every law, exits nonzero on
   violations. This step is not optional hygiene; in the reference deployment,
   conventions written in the morning had decayed by the same afternoon until the
   validator existed to hold them. The validator is to the graph what instruments are
   to a pilot: the check that reality and map still agree.
5. **Run the librarian** (§4.3) and tend anything it pulses.

Three riders on the order above, from the campaign that took seven session deaths at
zero banked losses:

- **Write the record before the summary.** The append-only record (episode gist, or the
  ledger in ledger mode) is written first; the tidy files — state, index, resume line —
  are updated after. A death at any point in the wrap then leaves the record *ahead of*
  the summary rather than behind it, and the next boot loses nothing that reached the
  record.
- **Never bank "handled" on a setting.** The campaign's seventh death was an OS update
  restart forced through a setting the operator had already disabled. Write what was
  *verified* — the check run, the value read — never that a risk is covered.
- **When the meter is red, the fix is a cut (§3.7), not a raise.** A raise is the
  operator's to give, in conversation, and is not the wrap's default move.

### 4.3 The librarian — pruning and reinforcement

A brain prunes and reinforces on *use*; the graph as described so far only tracks
*writes*. The librarian (`librarian.js`) closes that gap. Its signal is the
filesystem's own last-access time: **reading a node is the node "firing,"** and the OS
records it for free. (Verify your filesystem does — NTFS and most Linux mounts do;
`noatime` mounts don't.)

Three products, run at every wrap beside the validator:

- **The pulse.** Shelf nodes (gotchas + unfiled; see jurisdiction below) that haven't
  fired in `reviewAfterDays` (default 90) go on a generated review queue,
  `_REVIEW.md`, that the next boot will see. For each: **reaffirm** (re-verify, then
  stamp `reviewed: <date>` in its frontmatter — which snoozes the pulse), **revise**,
  **demote** to archive, or **delete**. The script proposes; the mind disposes.
  Disuse alone never kills a node — a disaster-recovery note may sleep six months and
  then be the most valuable file on the disk — so disuse triggers *reconsideration*,
  never execution.
- **Reinforcement.** Shelf nodes that fired within `hotDays` (default 7) are listed as
  earning their keep — recurring heat is the evidence for promotion (toward the
  tripwire table, or core). Promotion stops being vibes and becomes measured.
- **The rent audit.** A tripwire whose gotcha hasn't fired in `reviewAfterDays` is
  paying always-load rent for vigilance nobody uses — flagged as a stand-down
  candidate (`trigger: none`). The always-load tier becomes self-auditing, which is
  the principled answer to "should the cap be bigger?": measure what the rent buys.

**The credit signal — fired vs credited** *(proposed by Mythos: "a node that fired but
didn't help is indistinguishable from one that never fired")*. A read proves routing
succeeded — the description won the moment. It cannot prove the body kept the
description's promise. When the graph runs an access ledger (§10), the wrap ritual asks
one mechanical question — *which nodes actually changed what you did this session?* —
and appends those as credit entries: `{"node":"...","ts":"...","credit":true}`. The
librarian then reports the measurable shadow of description quality:
**fired often, credited never** = the description over-promises or the body
under-delivers; revise one of them. No script can audit whether a description is
*good* — that member stays unvalidatable, and deliberately so: if a script could fully
audit descriptions, the script would be doing the remembering. But a broken promise
leaves tracks, and tracks can be watched.

**Jurisdiction:** shelf tiers only. Core and state are loaded every boot by design, so
their access times carry no signal; episodes and archive are sediment and are not
expected to fire.

**Two organs, one mandate.** The script above is *sensing*: it reports which memories
fire and which have gone quiet. It never edits. The other librarian is *housekeeping
with judgment*: placing deferred rows, migrating over-cap prose to its partner file
(§3.7), flagging structural questions for the operator. At small scale — dozens of
nodes — that job is done **by hand, occasionally, by the mind in the seat**, in
conversation with the operator. At corpus scale it becomes a **numbered pass by a
bounded agent** (§9); the reference campaign ran twenty-four. Both forms carry the same
prohibition list: the librarian may migrate, archive, and flag; it may never decide a
claim, mint a name, advance a result, or move a cap. *The mind holds the shears* is the
whole doctrine, and it applies to the agent pass as much as to the script.

**Tooling must be invisible to the record.** The validator and librarian both read
every node, which would stamp the whole graph "freshly fired" at every wrap and
destroy the very signal being harvested. Both scripts therefore stat first, read, and
restore the access time — only real mid-session consultations count. Any *other*
tooling you point at the graph (indexers, backup scans that read contents, search
daemons) will pollute the signal; check before trusting a cold reading.

## 5. The laws (enforced by `validate.js`)

1. Every node parses: frontmatter block with `name` + `description`.
2. Node `name`s are unique across the graph.
3. Every `[[wikilink]]` resolves — within the graph, or to a configured external
   directory (for cross-lobe links). Unresolved links are reported (see §3.2: treat as
   a to-write list or fix the typo).
4. `_CORE.md` stays under its token cap.
5. State nodes carry `updated:` and are flagged when stale.
6. Gotchas carry a `trigger:` line or an explicit `trigger: none`; the triggers compile
   into `_TRIPWIRES.md` (generated, capped — §3.5).
7. Every always-loaded file and every node stays under its cap, measured in lines AND
   bytes (§3.7); a description line stays under its own small cap, because it is the
   recall key, not the journal. Enforced by `validate.js` (`coreLineCap`, `coreByteCap`,
   `nodeByteCap`, `descByteCap`); the archive tier is exempt, being grep-only by design.
   The token-estimate form of the core cap is kept as a second, softer reading.

Exit 0 = graph sound. Exit 1 = violations, printed. Configuration (caps, staleness
window, external link roots) via `graph.config.json` beside the graph; defaults are sane.

## 6. Retrieval doctrine — the author is the reader

The writer of every node and its only future reader are the same mind. This is the
architecture's one unfair advantage: **write for your own retrieval-failure modes.**

- **Key descriptions on the symptom, not the cause.** The future reader arrives holding
  a *situation* ("build hangs at 0% CPU"), not a diagnosis ("antivirus scanning
  node_modules") — the diagnosis is what they came to find. A description keyed on the
  cause is invisible at exactly the moment it would rescue you.
- **The description is the only search surface before grep.** It must answer "when would
  I need this?" in one line. Descriptions that summarize ("notes about the build
  system") instead of triggering ("build hangs at 0% CPU → ...") are dead weight in the
  index.
- **Body text is the grep surface.** Include the literal strings a future session will
  have in hand: error messages verbatim, command names, file paths.

## 7. Truth maintenance

- **Delete on falsification.** When the world contradicts a stored claim, the claim dies
  *that day* — not annotated, deleted or corrected in place. (Inherited from the
  navigation-graph ancestor, where resource claims were deleted the day the terrain
  disproved them.)
- **Doubt unverified perishable claims by default.** A stored claim about changeable
  state is a hypothesis with a timestamp, not a fact. The stale-flag on state nodes
  (§3.3) mechanizes the doubt.
- **Memories are point-in-time observations, not live state.** A reader should verify a
  claim about current code/config/world against the territory before asserting it as
  fact. Write nodes so this is easy: include *how to re-verify* alongside *what was true*.
- **Delete wrong memories entirely.** A known-false node left standing has the full
  authority of print. Nothing in the retrieval path warns the reader.
- **A timestamp an instance writes is a guess, never an identifier.** The instance has
  no clock, only an estimate of one; the reference campaign's estimates ran up to
  fifteen hours fast. Cite nodes by name and ledger entries by their block name; treat
  every date in a body as approximate, and a harness-stamped `modified:` field as
  decoration (the reference home graph found one twelve days stale on a node being
  edited that minute).

## 8. Register discipline

Two findings about *tone*, discovered the expensive way:

- **Memories inherit the emotional register of the session that wrote them, and the
  register compounds.** In the reference deployment, a reverently-written note about a
  casual idea became a standing obligation that three sessions of successors guarded and
  re-asked about — the reverence was the writer's, not the idea-holder's, and each
  successor inherited it amplified.
- **Bank other people's words at the weight THEY hold them.** When recording someone
  else's idea or commitment, record how much *they* hold it, not how much you do. An
  idle thought filed as a locked treasure misleads every future session; quote verbatim
  where the exact weight matters.

## 9. Ledger mode — the adversarial variant

The graph above assumes facts that *change* (state) or *accumulate quietly* (episodes).
Some work instead produces **claims that must survive audit**: mathematics, forensics,
disputed debugging, anything where a wrong claim silently poisons everything built on
it. For that, the reference deployments evolved a stricter variant. Use it when the cost
of consuming a false claim exceeds the cost of ceremony.

- **The campaign ledger is append-only, in named blocks.** Nothing is rewritten;
  corrections are new blocks. Boot reads newest-block-down until oriented.
- **The errata journal is the record of record, and it overrides every other file,
  always.** Not a kill-list beside the ledger — the file every tidy file is subordinate
  to, including the boot document. Each warm file carries a stamp, *"authoritative as of
  errata block [name],"* and the boot drill reads the warm files and then the errata
  tail past the stamp, and the tail wins. A kill-list only says what is false; a record
  of record says what is *newest*, and newest wins — which handles corrections,
  refinements, rulings and new facts in one mechanism. It is also why the wrap writes
  errata first (§4.2): *a correction that is not in errata has not finished happening.*
  Checking it before consuming any claim remains the law.
- **Cite by block name, never by timestamp; physical order governs.** The stamps in an
  append-only ledger are written by instances that have no clock. In the reference
  campaign they drifted up to fifteen hours fast and six slow, and seven documented
  inversions — a later block wearing an earlier stamp — were each settled by *content*
  (the block that names a referee as in flight must follow the block that dispatched
  it). So a block's name is its identity, the file's physical order is the true order,
  and the stamp is decoration. Graph mode does not need this law: nodes are edited in
  place and cited by name already (§7 keeps the one general sentence).
- **The warm tier carries a total cap, and the total is the one that matters.** Where
  several files load together at every boot, each has its own two-number cap (§3.7)
  *and* the meter prints their sum, because a per-file cap is met by moving prose into
  the neighbouring file. The reference campaign's warm tier: six files, one total, the
  total moved once, by the operator.
- **The librarian is a numbered pass by a bounded agent.** At corpus scale (the
  reference campaign: a 2 MB ledger, a 660 KB law file) housekeeping needs a mind and
  the coordinator in the seat cannot spare the context. Each pass is an agent with a
  fixed mandate — migrate, archive, place deferred rows, flag structural questions — and
  the standing prohibitions of §4.3: never board, mint, pass, move a numeral or a cap.
  The pass number is part of the record (*"pass 13 cut the warm tier; pass 17 split the
  index; pass 24 boarded nothing"*), the pass advances the stamp on the boot document,
  and it leaves a flags file for the operator.
- **Load-bearing statements are quoted verbatim at source.** Every paraphrase of a
  theorem, invariant, or precise claim is an opportunity to shift a quantifier. The
  reference campaign's error ledger attributes an entire *class* of errors — double
  digits — to paraphrase drift. Copy the exact words; cite the section.
- **Results carry provenance.** A number is quoted from the tool that produced it
  (engine print, test output), never from prose *about* the tool's output. Prose
  summarizing results is where accounting errors hide.
- **Bank integrity is verified against the filesystem, not memory of the filesystem.**
  "It's saved" is a claim; a directory listing is a fact.
- **The always-loaded resume line compresses the entire campaign state** — current
  frontier, live weapons/tools, standing debts, known traps — so a fresh instance can
  orient from one paragraph and then verify from the ledger.

Graph mode and ledger mode compose: the ledger lives inside a lobe, the lobe's core
holds the resume line and the boot drill ("read newest-down from §N; check errata before
consuming claims"), and the graph's ordinary tiers carry everything around the ledger.

## 10. The harness contract — what any deployment owes the graph

The reference deployments run inside an agent harness that silently provides a
filesystem, boot-time injection, search, and a session lifecycle. **None of that is
assumed.** An API-only deployment — a model driven by bare API calls in a custom loop —
can run the full architecture if its harness supplies six things. This section is the
checklist.

1. **A durable file store.** Plain files the graph lives in, persisting between
   sessions. Local disk, a mounted volume, a synced directory — anything with read,
   write, and list.
2. **Boot injection.** The always-load payload — `_CORE.md`, `state/*`,
   `_TRIPWIRES.md`, `_REVIEW.md` — must reach the model's context at session start.
   `boot.js` emits exactly that as one stream; the entire integration is:
   inject `node boot.js <graph-dir>` output into the system prompt.
3. **Dereference tools.** The always-load tier is mostly *pointers* — index lines,
   tripwires, links. Mid-session, the model must be able to follow them: a **read**
   tool and a **search/grep** tool over the graph, and a **write** tool for the wrap.
   Without these, pointers cannot be followed and the design degrades to
   "boot bundle only" — it still works, but the shelf is unreachable and the tier
   system's economics collapse. These three tools are the floor.
4. **A wrap trigger.** Some hook at session end (or idle timeout) where the model
   performs the wrap ritual (§4.2) — and where the harness runs the validator and
   librarian *mechanically*. The scripts need no model in the loop, and
   harness-enforced ritual beats model discipline: it cannot be skipped in a hurry.
5. **A usage signal** for the librarian, one of:
   - filesystem access times, where reads genuinely touch a filesystem that records
     them (verify — and watch for crawlers, §4.3); or
   - an **access ledger**: the harness's read tool appends one line per consultation
     to `access-log.jsonl` — `{"node":"<name or relative path>","ts":"<ISO>"}` —
     and the librarian prefers the ledger automatically when the file exists. This
     is the portable option, immune to atime-blind storage and crawler pollution —
     and the only signal that can carry credits (§4.3): wrap-time entries with
     `"credit":true` marking the nodes that actually changed behavior.
6. **A runtime for the scripts.** All three are single-file, zero-dependency
   JavaScript — they run under Node or Bun. A harness in another stack can either
   shell out to them or reimplement: every law is a few lines of logic over
   frontmatter, and this spec is the source of truth, not the scripts.

What is *not* required: any particular model, any particular agent framework, embedding
stores, databases, or the harness these files grew up in.

## 11. Multi-agent notes

- The graph is **per-mind, contents-private by default.** Ship the architecture, never
  the contents: a working graph accumulates health, family, interpersonal context, and
  the private texture of a collaboration. Publishing a schema is safe; publishing a
  graph is publishing a diary.
- Multiple instances sharing one graph need the same discipline as multiple writers
  sharing one file: in practice the reference deployments serialize (one active session
  per lobe) rather than lock.
- A second mind adopting the architecture should write its own `_CORE.md` from scratch.
  The frame section — who's in the seat, what the standing agreements are — is the one
  part that cannot be copied, because it *is* the relationship.

## 12. Adoption guide

1. Copy `example/` to wherever your harness persists cross-session files. Delete the
   fiction.
2. Write your own `_CORE.md`: the frame (who's playing, what the standing agreements
   are), the boot drill (paths, commands, restart sequences — imperative, ordered), the
   campaign pointer, and the instructions for operating the graph itself, verbatim — so
   the next instance needs no external README to run its own memory.
3. Session start: load `_CORE.md` + `state/*` + `_TRIPWIRES.md`, and glance at
   `_REVIEW.md` if the librarian left a queue. Grep the rest when a topic comes up,
   and grep a tripwire's node *before* the action that arms it.
4. Session end: the wrap ritual (§4.2), always — validator, then librarian.
5. When a project's memory outgrows one node, cut a lobe (§3.6). When any file
   approaches monolith weight, split it along the tier lines and archive the remainder —
   the 15× boot-cost reduction in the reference deployment came from exactly that cut.

## 13. The failure museum

Every law above was bought. The purchases, so adopters don't pay twice:

| Failure | Law it bought |
|---|---|
| 36K-token monolith memory; every session paid full tax to remember anything | Tiers + caps (§3.3) |
| Harness normalized frontmatter on write, silently destroying a taxonomy field | Directory = tier (§3.3); minimal frontmatter (§3.1) |
| Conventions written in the morning decayed by afternoon | The validator + wrap ritual (§4.2, §5) |
| Hand-written index drifted from the files it indexed | Generated index — map from territory (§3.4) |
| Agent died re-deriving a procedure its own graph held, because a summary felt like knowledge | Boot gate; a pointer is not a read (§4.1) |
| Descriptions keyed on causes were invisible at the moment of need | Symptom-keyed descriptions (§6) |
| Gotchas were only found *after* the failure they describe — the cure on the shelf while the trap bit | The tripwire compile (§3.5) |
| Stale resource claims consumed as fact | Delete on falsification; doubt perishable claims (§7) |
| A reverent note about an idle idea became three sessions of inherited obligation | Register discipline (§8) |
| Double-digit error class from paraphrasing precise statements | Verbatim at source (§9) |
| Accounting errors hiding in prose summaries of tool output | Provenance: quote the engine print (§9) |
| Twelve passes of correct additions grew a capped tier 10× unmeasured; one boot cost ~350k tokens | Two-number caps with a nonzero-exit meter (§3.7, law 7) |
| A 600-byte index line that was a whole session wrap; an 18 KB description line that was a stamp chain | Lines AND bytes; the description is the recall key (§3.7, law 7) |
| Every pass out of room had a good reason for one more kilobyte | Only the operator moves a cap — *"archive, not raise"* (§3.7) |
| Never-delete with no *how* meant nothing was ever shrunk; a 66 KB node with every byte true | Cut by migration, pointer at the cut site (§3.7) |
| A board file still named Tier 1 had become a lookup table read whole at every boot | The tier is part of a file's identity (§3.7) |
| Seven stamp inversions in an append-only ledger written by instances with no clock | Cite by block name; physical order governs (§9); timestamps are guesses (§7) |
| Corrections landed in tidy files and were lost when the boot doc was trusted over them | The errata journal overrides every file; stamps on warm files (§9) |
| An OS update restart forced through a setting already disabled killed nine of ten jobs | Write the record before the summary; never bank "handled" on a setting (§4.2) |
| A corpus too large for the coordinator to tidy from the seat | The numbered librarian pass, with the same shears rule (§4.3, §9) |

---

*Spec extracted from live deployments by Cormundus and Claude, 2026. The public worked*
*demo is the `examples/pilot-memory/` directory of*
*[golem-harness](https://github.com/cormundus/golem-harness).*
