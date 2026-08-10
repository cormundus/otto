#!/usr/bin/env node
// validate.js — the graph's instrument check: renders GRAPH.md FROM the nodes' own
// frontmatter (the map is generated from the territory, never hand-drawn) and enforces
// the graph's laws (SPEC.md §5):
//   1. every node parses (frontmatter with name + description)
//   2. node names are unique
//   3. every [[wikilink]] resolves — in-graph or in a configured external directory
//   4. _CORE.md stays under its token cap (it is the always-load tier)
//   5. state nodes carry an `updated:` stamp and are flagged when stale
//   6. gotchas carry a `trigger:` line (or an explicit `trigger: none`); the triggers
//      compile into _TRIPWIRES.md — always-loaded pointers that fire BEFORE the trap
// Usage: node validate.js [graph-dir]     (defaults to the script's own directory)
// Config: optional graph.config.json in the graph dir:
//   { "coreTokenCap": 2800, "stateStaleDays": 7, "externalLinkDirs": ["../"],
//     "allowForwardLinks": false, "tripwireTokenCap": 600 }
// Exit 0 = graph sound. Exit 1 = violations (printed). Run at every session wrap.
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(process.argv[2] || __dirname)

const DEFAULTS = { coreTokenCap: 2800, stateStaleDays: 7, externalLinkDirs: [], allowForwardLinks: false, tripwireTokenCap: 600 }
let config = DEFAULTS
const configPath = path.join(ROOT, 'graph.config.json')
if (fs.existsSync(configPath)) {
  try { config = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^﻿/, '')) } } catch (err) {
    console.error(`graph.config.json unreadable: ${err.message}`)
    process.exit(1)
  }
}

function walk (dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.name.endsWith('.md') && e.name !== 'GRAPH.md' && e.name !== '_TRIPWIRES.md' && e.name !== '_REVIEW.md') out.push(p)
  }
  return out
}

// tier comes from the PATH, not frontmatter: some memory harnesses normalize frontmatter
// on write (SPEC §3.1), and a directory cannot be normalized away. Frontmatter `tier:` is
// accepted as an explicit override for layouts that differ.
function tierOf (file, fm) {
  if (fm.tier) return fm.tier
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  if (rel === '_CORE.md') return 'core'
  if (rel.startsWith('state/')) return 'state'
  if (rel.startsWith('gotchas/')) return 'gotcha'
  if (rel.startsWith('episodes/')) return 'episode'
  if (rel.startsWith('archive')) return 'archive'
  return 'unfiled'
}

function parseNode (file) {
  // stat-read-restore: the librarian's usage signal is the file's last-access time, and
  // this crawl reads every node — without the restore, every wrap would stamp the whole
  // graph "freshly fired" and destroy the signal. Tooling must be invisible to the record.
  const st = fs.statSync(file)
  // strip a UTF-8 BOM: Windows tooling (PowerShell 5.1 among others) writes one, and a
  // BOM in front of `---` silently defeats the frontmatter match
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '')
  try { fs.utimesSync(file, st.atime, st.mtime) } catch (err) {}
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return { file, error: 'no frontmatter block' }
  const fm = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z_]+):\s*(.*)$/)
    if (kv) fm[kv[1]] = kv[2].replace(/^"|"$/g, '')
  }
  const body = raw.slice(m[0].length)
  const links = [...body.matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]*)?\]\]/gi)].map(x => x[1])
  return { file, name: fm.name, description: fm.description, tier: tierOf(file, fm), updated: fm.updated, trigger: fm.trigger, links, chars: raw.length }
}

// links may legitimately point OUTSIDE this graph (a parent constellation, sibling lobes).
// Index the node names of every configured external directory so those links resolve.
function externalNames () {
  const names = new Set()
  for (const dir of config.externalLinkDirs) {
    const abs = path.resolve(ROOT, dir)
    if (!fs.existsSync(abs)) continue
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith('.md')) continue
      try {
        const p = path.join(abs, e.name)
        const st = fs.statSync(p)
        const head = fs.readFileSync(p, 'utf8').slice(0, 400)
        try { fs.utimesSync(p, st.atime, st.mtime) } catch (err) {}
        const nm = head.match(/^name:\s*"?([^"\r\n]+)"?\s*$/m)
        if (nm) names.add(nm[1].trim())
      } catch (err) {}
    }
  }
  return names
}

const problems = []
const warnings = []
const nodes = walk(ROOT).map(parseNode)

// law 1+2: parse + unique names
const byName = new Map()
for (const n of nodes) {
  if (n.error) { problems.push(`${path.relative(ROOT, n.file)}: ${n.error}`); continue }
  if (!n.name || !n.description) problems.push(`${path.relative(ROOT, n.file)}: frontmatter missing name/description`)
  if (n.name) {
    if (byName.has(n.name)) problems.push(`duplicate node name '${n.name}' (${path.relative(ROOT, n.file)} vs ${path.relative(ROOT, byName.get(n.name).file)})`)
    else byName.set(n.name, n)
  }
}

// law 3: links resolve — within the graph or in an external constellation.
// With allowForwardLinks, danglers downgrade to warnings: a forward link marks
// something worth writing (SPEC §3.2), and the warning keeps it on the to-write list.
const external = externalNames()
for (const n of nodes) {
  for (const l of n.links || []) {
    if (byName.has(l) || external.has(l)) continue
    const msg = `${n.name || path.relative(ROOT, n.file)}: dangling link [[${l}]]`
    if (config.allowForwardLinks) warnings.push(msg + ' (forward link — write it or fix the typo)')
    else problems.push(msg)
  }
}

// law 4: _CORE token cap (~4 chars/token heuristic)
const core = nodes.find(n => n.tier === 'core')
if (!core) problems.push('no _CORE.md (core tier) node found')
else {
  const tokens = Math.round(core.chars / 4)
  if (tokens > config.coreTokenCap) problems.push(`_CORE.md ≈${tokens} tokens > cap ${config.coreTokenCap} — demote something to state/gotchas/episodes`)
}

// law 5: state freshness
const now = Date.now()
for (const n of nodes) {
  if (n.tier !== 'state') continue
  if (!n.updated) { problems.push(`state node '${n.name}' has no updated: stamp`); continue }
  const age = (now - new Date(n.updated).getTime()) / 86400000
  if (age > config.stateStaleDays) warnings.push(`state node '${n.name}' is ${Math.floor(age)} days stale — verify or update`)
}

// law 6: tripwires — every gotcha declares when it fires, or explicitly opts out.
// A gotcha without a trigger is invisible until AFTER the trap bites; the trigger line
// is the ~15-token pointer that rides in the always-load so the ~200-token body can
// stay on the shelf.
const tripwires = []
for (const n of nodes) {
  if (n.tier !== 'gotcha') continue
  if (!n.trigger) { warnings.push(`gotcha '${n.name}' has no trigger: line — invisible until after it bites; add one or opt out with trigger: none`); continue }
  if (n.trigger.toLowerCase() === 'none') continue
  tripwires.push({ trigger: n.trigger, name: n.name })
}
tripwires.sort((a, b) => a.name.localeCompare(b.name))
const twLines = ['# _TRIPWIRES.md — generated by validate.js. DO NOT EDIT (edit the gotchas\' trigger: lines).',
  '# Always-load with _CORE and state/. Before acting, if a line matches what you are about to do, grep the named node FIRST.', '']
for (const t of tripwires) twLines.push(`- IF ${t.trigger} → read [[${t.name}]]`)
const twText = twLines.join('\n') + '\n'
fs.writeFileSync(path.join(ROOT, '_TRIPWIRES.md'), twText)
const twTokens = Math.round(twText.length / 4)
if (twTokens > config.tripwireTokenCap) warnings.push(`_TRIPWIRES.md ≈${twTokens} tokens > cap ${config.tripwireTokenCap} — too many standing tripwires; demote the rarely-armed ones to plain gotchas (trigger: none)`)

// render GRAPH.md — the generated index
const order = ['core', 'state', 'gotcha', 'episode', 'archive', 'unfiled']
const lines = ['# GRAPH.md — generated by validate.js. DO NOT EDIT (edit the nodes).', '']
for (const t of order) {
  const group = nodes.filter(n => n.tier === t).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  if (!group.length) continue
  lines.push(`## ${t}`)
  for (const n of group) {
    const rel = path.relative(ROOT, n.file).replace(/\\/g, '/')
    const edges = (n.links || []).length ? `  →  ${[...new Set(n.links)].map(l => `[[${l}]]`).join(' ')}` : ''
    lines.push(`- **${n.name}** (${rel}, ≈${Math.round(n.chars / 4)}tok) — ${n.description}${edges}`)
  }
  lines.push('')
}
fs.writeFileSync(path.join(ROOT, 'GRAPH.md'), lines.join('\n'))

const tokTotal = Math.round(nodes.reduce((s, n) => s + (n.chars || 0), 0) / 4)
const alwaysLoad = Math.round(((core ? core.chars : 0) + twText.length + nodes.filter(n => n.tier === 'state').reduce((s, n) => s + n.chars, 0)) / 4)
console.log(`graph: ${nodes.length} nodes, ≈${tokTotal} tokens on disk; always-load ≈${alwaysLoad} tokens (core+state+tripwires)`)
for (const w of warnings) console.log('  ⚠ ' + w)
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`)
  for (const p of problems) console.log('  ✗ ' + p)
  process.exit(1)
}
console.log('graph sound ✓ (GRAPH.md regenerated)')
