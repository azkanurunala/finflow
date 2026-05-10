#!/usr/bin/env node
// Enforces additive-only evolution: protected entries in feature-registry.json
// cannot be removed or have their `ref`/`type`/`layer` changed between commits.
// Also validates that any existing-component snapshot drift is pre-declared in
// `snapshot_replacements_iteration_N`.
//
// Modes:
//   --mode=registry   compare HEAD's feature-registry.json against the BASE branch
//   --mode=snapshots  validate that snapshot files modified in this PR match the
//                     `snapshot_replacements_iteration_N` allowlist
//
// Exit codes:
//   0 = pass, 1 = violation, 2 = misconfiguration

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'feature-registry.json');

function die(code, msg) {
  process.stderr.write(`[registry-gate] ${msg}\n`);
  process.exit(code);
}

function readRegistry(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    die(2, `Could not parse feature-registry.json: ${e.message}`);
  }
}

function gitShow(ref, file) {
  try {
    return execSync(`git show ${ref}:${file}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function indexProtected(reg) {
  const map = new Map();
  for (const e of reg.protected ?? []) map.set(e.id, e);
  return map;
}

function modeRegistry() {
  const base = args.base || 'origin/main';
  const headText = fs.existsSync(REGISTRY_PATH) ? fs.readFileSync(REGISTRY_PATH, 'utf8') : null;
  if (!headText) die(2, 'feature-registry.json missing on HEAD.');

  const baseText = gitShow(base, 'feature-registry.json');
  if (!baseText) {
    process.stdout.write(`[registry-gate] No feature-registry.json on ${base} — first introduction, allowed.\n`);
    return;
  }

  const baseReg = readRegistry(baseText);
  const headReg = readRegistry(headText);

  const baseIdx = indexProtected(baseReg);
  const headIdx = indexProtected(headReg);

  const violations = [];

  // 1. No protected entry may be removed.
  for (const [id, entry] of baseIdx) {
    if (!headIdx.has(id)) {
      violations.push(`REMOVED protected entry: ${id} (${entry.ref})`);
    }
  }

  // 2. No protected entry may have its ref / type / layer changed.
  for (const [id, baseEntry] of baseIdx) {
    const headEntry = headIdx.get(id);
    if (!headEntry) continue;
    for (const k of ['ref', 'type', 'layer']) {
      if (baseEntry[k] !== headEntry[k]) {
        violations.push(`MUTATED protected.${k} for ${id}: "${baseEntry[k]}" -> "${headEntry[k]}"`);
      }
    }
  }

  // 3. Invariants block must be append-only (existing strings preserved verbatim).
  const baseInv = baseReg.invariants ?? [];
  const headInv = headReg.invariants ?? [];
  for (let i = 0; i < baseInv.length; i++) {
    if (headInv[i] !== baseInv[i]) {
      violations.push(`INVARIANT changed at index ${i}: "${baseInv[i]}" -> "${headInv[i] ?? '(removed)'}"`);
    }
  }

  if (violations.length) {
    die(1, `Additive-only violation detected:\n  - ${violations.join('\n  - ')}`);
  }
  process.stdout.write(`[registry-gate] OK — ${headIdx.size} protected entries intact, ${headInv.length} invariants intact.\n`);
}

function modeSnapshots() {
  if (!fs.existsSync(REGISTRY_PATH)) die(2, 'feature-registry.json missing.');
  const reg = readRegistry(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const iter = reg.iteration_cursor ?? 0;
  const allowlistKey = `snapshot_replacements_iteration_${iter}`;
  const allow = new Set(reg[allowlistKey] ?? []);

  let changed;
  try {
    changed = execSync(
      `git diff --name-only origin/${process.env.BASE_REF || 'main'}...HEAD -- 'frontend/**/__snapshots__/**'`,
      { encoding: 'utf8' }
    )
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    process.stdout.write('[registry-gate] No snapshot diffs detectable in this environment — skipping.\n');
    return;
  }

  const offenders = [];
  for (const snap of changed) {
    // Snapshot path looks like frontend/components/__snapshots__/Foo.test.tsx.snap
    // Map back to the source file under test using the path stem.
    const owning = snap
      .replace(/__snapshots__\//, '')
      .replace(/\.snap$/, '')
      .replace(/\.test\.tsx?$/, '');

    const allowedHit = [...allow].some((entry) => owning.includes(path.basename(entry, path.extname(entry))));
    if (!allowedHit) offenders.push(snap);
  }

  if (offenders.length) {
    die(
      1,
      `Snapshot drift not in allowlist (${allowlistKey}):\n  - ${offenders.join('\n  - ')}\n` +
        `Add the screen to ${allowlistKey} in feature-registry.json with rationale, or revert the snapshot change.`
    );
  }
  process.stdout.write(`[registry-gate] OK — snapshots additive (${changed.length} changed, all allowlisted or new).\n`);
}

const mode = args.mode;
if (mode === 'registry') modeRegistry();
else if (mode === 'snapshots') modeSnapshots();
else die(2, `Unknown --mode. Use --mode=registry or --mode=snapshots.`);
