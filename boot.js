#!/usr/bin/env node
// boot.js — emits the graph's always-load payload as one stream, for harnesses that
// don't auto-inject memory (an API-only deployment injects this into the system
// prompt at session start; that's the entire integration):
//   node boot.js [graph-dir]  >>  system prompt
// Order: _CORE.md, state/* (sorted), _TRIPWIRES.md, _REVIEW.md — core first because
// it carries the boot drill and the instructions for operating everything after it.
// Contents are verbatim, frontmatter included (descriptions are load-bearing).
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(process.argv[2] || __dirname)

function emit (rel) {
  const p = path.join(ROOT, rel)
  if (!fs.existsSync(p)) return
  const st = fs.statSync(p)
  const raw = fs.readFileSync(p, 'utf8').replace(/^﻿/, '')
  // boot injection is a LOAD, not a consultation — restore atime so always-load files
  // don't read as "fired" (they carry no usage signal anyway; SPEC §4.3 jurisdiction)
  try { fs.utimesSync(p, st.atime, st.mtime) } catch (err) {}
  process.stdout.write(`\n===== ${rel.replace(/\\/g, '/')} =====\n\n${raw.trimEnd()}\n`)
}

emit('_CORE.md')
const stateDir = path.join(ROOT, 'state')
if (fs.existsSync(stateDir)) {
  for (const f of fs.readdirSync(stateDir).filter(f => f.endsWith('.md')).sort()) emit(path.join('state', f))
}
emit('_TRIPWIRES.md')
emit('_REVIEW.md')
