#!/usr/bin/env node
// librarian.js — the graph's gardener. The validator is the cop (laws, caps, links);
// this is the other official: it watches what actually gets USED, and runs the
// prune-and-reinforce cycle a brain gets for free:
//   - PULSE:     shelf nodes that haven't fired in a long time go on a review queue —
//                reaffirm, revise, demote, or delete. The script proposes; the mind
//                disposes. Nothing is ever deleted automatically: disuse is a reason
//                to RECONSIDER a memory, never to execute it.
//   - REINFORCE: shelf nodes that keep firing are promotion candidates (toward the
//                tripwire table, or core).
//   - RENT AUDIT: tripwires whose gotcha never fires are paying always-load rent for
//                vigilance nobody uses — stand-down candidates.
// The signal, in preference order:
//   1. access-log.jsonl in the graph root, if present — an explicit ledger for
//      harnesses whose reads never touch a real filesystem (API-only deployments,
//      object stores, cached reads). The harness's read tool appends one line per
//      consultation: {"node":"<name or relative path>","ts":"<ISO timestamp>"}
//      Wrap-time CREDIT entries ({"node","ts","credit":true}) mark nodes that
//      actually changed behavior; fired-often-credited-never = a broken promise
//      (description over-promises or body under-delivers) — the measurable shadow
//      of description quality. [credit signal proposed by Mythos]
//   2. the filesystem's own last-access time — free where the OS records it
// Jurisdiction: shelf tiers only (gotcha + unfiled). Core and state are loaded every
// boot by design, so their access times carry no signal; episodes and archive are
// sediment and are not expected to fire.
// Usage: node librarian.js [graph-dir]
// Config (graph.config.json): { "reviewAfterDays": 90, "hotDays": 7,
//   "signal": "auto",    // "auto" = ledger if present, else atime; or force "ledger"/"atime"
//   "brokenPromiseMinFires": 3,     // fires with zero credits before a node is flagged
//   "excludeDirs": ["some-lobe", "_archive"] }   // subdirs this run does not walk (lobes run their own)
// Always exits 0 — the gardener advises, it does not fail the build.
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(process.argv[2] || __dirname)

const DEFAULTS = { reviewAfterDays: 90, hotDays: 7, signal: 'auto', brokenPromiseMinFires: 3, excludeDirs: [] }
let config = DEFAULTS
const configPath = path.join(ROOT, 'graph.config.json')
if (fs.existsSync(configPath)) {
  try { config = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^﻿/, '')) } } catch (err) {}
}

const GENERATED = new Set(['GRAPH.md', '_TRIPWIRES.md', '_REVIEW.md'])

function walk (dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!config.excludeDirs.includes(e.name)) out.push(...walk(p)) }
    else if (e.name.endsWith('.md') && !GENERATED.has(e.name)) out.push(p)
  }
  return out
}

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

// Read a node WITHOUT polluting the evidence: our own read would stamp the access
// time and make every node look freshly fired. Stat first, read, restore. Tooling
// must be invisible to the record — only real mid-session consultations count.
function parseNodePreservingAtime (file) {
  const st = fs.statSync(file)
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '')
  try { fs.utimesSync(file, st.atime, st.mtime) } catch (err) {}
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return null
  const fm = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z_]+):\s*(.*)$/)
    if (kv) fm[kv[1]] = kv[2].replace(/^"|"$/g, '')
  }
  return { file, name: fm.name, description: fm.description || '', tier: tierOf(file, fm), trigger: fm.trigger, reviewed: fm.reviewed, atime: st.atime }
}

const now = Date.now()
const days = ms => Math.floor(ms / 86400000)

// the ledger, when a harness keeps one: node/path → most recent consultation
const ledgerPath = path.join(ROOT, 'access-log.jsonl')
let ledger = null
if (config.signal !== 'atime' && fs.existsSync(ledgerPath)) {
  ledger = { last: new Map(), fires: new Map(), credits: new Map() }
  for (const line of fs.readFileSync(ledgerPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line)
      const ts = new Date(e.ts).getTime()
      const key = String(e.node).replace(/\\/g, '/')
      if (isNaN(ts)) continue
      if (!ledger.last.has(key) || ts > ledger.last.get(key)) ledger.last.set(key, ts)
      ledger.fires.set(key, (ledger.fires.get(key) || 0) + 1)
      if (e.credit) ledger.credits.set(key, (ledger.credits.get(key) || 0) + 1)
    } catch (err) {}
  }
} else if (config.signal === 'ledger') {
  console.log('signal: "ledger" configured but no access-log.jsonl found — falling back to atime')
}

// last-fired for a node: ledger entry (by name or relative path) if the ledger is
// live, else the file's atime. A ledgered graph with no entry for a node means it
// has not fired since logging began — but its atime still bounds the answer.
function ledgerKeys (n) {
  return [n.name, path.relative(ROOT, n.file).replace(/\\/g, '/')]
}
function lastFiredMs (n) {
  if (ledger) {
    for (const k of ledgerKeys(n)) if (ledger.last.has(k)) return ledger.last.get(k)
  }
  return n.atime.getTime()
}
function tally (map, n) {
  return ledgerKeys(n).reduce((s, k) => s + (map.get(k) || 0), 0)
}

const nodes = walk(ROOT).map(parseNodePreservingAtime).filter(Boolean)
const shelf = nodes.filter(n => n.tier === 'gotcha' || n.tier === 'unfiled')

const due = []
const hot = []
const rentAudit = []
for (const n of shelf) {
  const lastFired = days(now - lastFiredMs(n))
  // a `reviewed:` stamp snoozes the pulse: reaffirming a node counts as tending it
  const lastTended = n.reviewed ? Math.min(lastFired, days(now - new Date(n.reviewed).getTime())) : lastFired
  if (lastTended > config.reviewAfterDays) due.push({ ...n, lastFired })
  else if (lastFired <= config.hotDays) hot.push({ ...n, lastFired })
  if (n.tier === 'gotcha' && n.trigger && n.trigger.toLowerCase() !== 'none' && lastTended > config.reviewAfterDays) {
    rentAudit.push({ ...n, lastFired })
  }
}
due.sort((a, b) => b.lastFired - a.lastFired)

// the pulse: written where the next boot will see it
const lines = ['# _REVIEW.md — generated by librarian.js. DO NOT EDIT (tend the nodes).',
  '# For each node below: reaffirm (bump `reviewed: YYYY-MM-DD` after re-verifying), revise, demote to archive, or delete.', '']
if (due.length) {
  for (const n of due) lines.push(`- **${n.name}** (${n.tier}, last fired ${n.lastFired}d ago) — ${n.description}`)
} else {
  lines.push('*(review queue empty — every watched node has fired or been tended recently)*')
}
fs.writeFileSync(path.join(ROOT, '_REVIEW.md'), lines.join('\n') + '\n')

console.log(`librarian: watching ${shelf.length} shelf node(s) (gotcha+unfiled) of ${nodes.length} total — signal: ${ledger ? 'access-log.jsonl' : 'filesystem atime'}`)
if (due.length) {
  console.log(`\nPULSE — due for review (last fired/tended >${config.reviewAfterDays}d ago):`)
  for (const n of due) console.log(`  ? ${n.name} (${n.tier}) — last fired ${n.lastFired}d ago`)
} else console.log('review queue empty ✓')
if (hot.length) {
  console.log(`\nREINFORCE — fired within ${config.hotDays}d (earning their keep; promotion candidates if recurring):`)
  for (const n of hot) console.log(`  ★ ${n.name} (${n.tier}) — fired ${n.lastFired}d ago`)
}
for (const n of rentAudit) console.log(`\nRENT AUDIT — tripwire '${n.name}' hasn't fired in ${n.lastFired}d: stand-down candidate (set trigger: none if the vigilance isn't earning its rent)`)
// the credit signal (Mythos): routing that succeeds while the body breaks the promise
if (ledger) {
  const broken = shelf.filter(n => tally(ledger.fires, n) >= config.brokenPromiseMinFires && tally(ledger.credits, n) === 0)
  for (const n of broken) console.log(`\nBROKEN PROMISE — '${n.name}' fired ${tally(ledger.fires, n)}× and was never credited: the description over-promises or the body under-delivers; revise one of them`)
}
console.log(`\nreview queue written to _REVIEW.md`)
