#!/usr/bin/env node
/**
 * G4 — i18n coverage audit.
 *
 * Scans frontend/app/ and frontend/components/ for user-visible string literals
 * that are not routed through the `t(...)` translator function. Findings are
 * reported as file:line with a snippet so they can be migrated incrementally.
 *
 * Usage:
 *   node scripts/audit-i18n.js [--strict]
 *   --strict  exit 1 if any findings (for CI gate); otherwise exits 0.
 *
 * Heuristics it flags (with intentional, named exceptions):
 *   - JSX text:                     <Text>Hello world</Text>
 *   - placeholder/title/label:      placeholder="Enter amount"
 *   - Alert.alert calls:            Alert.alert('Error', 'Something failed')
 *
 * False-positive minimisation: lines containing `t(` or already templated with
 * `${t(...)}` are skipped. Strings consisting only of punctuation, numbers,
 * single chars, or matching the SKIP_PATTERNS list are ignored.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface Finding {
  file: string;
  line: number;
  rule: 'jsx-text' | 'attribute' | 'alert';
  snippet: string;
}

const SKIP_PATTERNS: RegExp[] = [
  /^[\s\d.,:;!?$%@#&*()_+=\-/\\<>\[\]{}|]*$/, // pure punctuation/numbers
  /^[A-Z_]+$/, // CONSTANT_NAMES
  /^https?:/i, // URLs
  /^[a-z][a-z0-9]+:/, // mongodb://, etc.
  /^\.\//, // path literals
  /^[a-z_][a-z0-9_]*$/, // pure lowercase identifier (variable name); leave PascalCase / capitalised words alone
];

const ALLOWED_FILE_EXTS = new Set(['.ts', '.tsx']);
const TARGET_DIRS = ['app', 'components'];

function shouldSkipString(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 2) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries: any[];
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true })) as any[];
  } catch {
    return;
  }
  for (const entry of entries) {
    const name = String(entry.name);
    const full = path.join(dir, name);
    if (entry.isDirectory()) {
      if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
      yield* walk(full);
    } else if (entry.isFile() && ALLOWED_FILE_EXTS.has(path.extname(name))) {
      yield full;
    }
  }
}

const RX_JSX_TEXT = /<Text[^>]*>([^<{}\n][^<{}\n]*)<\/Text>/g;
const RX_PLACEHOLDER = /\b(placeholder|title|label|accessibilityLabel|message)\s*=\s*["']([^"'{}\n]{2,})["']/g;
const RX_ALERT = /Alert\.alert\s*\(\s*["']([^"'\n]{2,})["']/g;

function findHardcodedStrings(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split(/\r?\n/);

  // Line short-circuit: only skip if the line contains a true `t(...)` call,
  // matched with a word boundary so we don't false-positive on `Alert.alert("..."`.
  const RX_T_CALL = /\bt\s*\(\s*["'`]/;
  lines.forEach((line, idx) => {
    if (RX_T_CALL.test(line)) return;
    let m: RegExpExecArray | null;

    RX_JSX_TEXT.lastIndex = 0;
    while ((m = RX_JSX_TEXT.exec(line))) {
      const text = m[1];
      if (!shouldSkipString(text)) {
        findings.push({ file: filePath, line: idx + 1, rule: 'jsx-text', snippet: text.trim() });
      }
    }

    RX_PLACEHOLDER.lastIndex = 0;
    while ((m = RX_PLACEHOLDER.exec(line))) {
      const text = m[2];
      if (!shouldSkipString(text)) {
        findings.push({ file: filePath, line: idx + 1, rule: 'attribute', snippet: `${m[1]}="${text}"` });
      }
    }

    RX_ALERT.lastIndex = 0;
    while ((m = RX_ALERT.exec(line))) {
      const text = m[1];
      if (!shouldSkipString(text)) {
        findings.push({ file: filePath, line: idx + 1, rule: 'alert', snippet: text });
      }
    }
  });

  return findings;
}

export async function auditDirectory(rootDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const dir of TARGET_DIRS) {
    const full = path.join(rootDir, dir);
    for await (const filePath of walk(full)) {
      const content = await fs.readFile(filePath, 'utf8');
      findings.push(...findHardcodedStrings(filePath, content));
    }
  }
  return findings;
}

async function main(argv: string[]): Promise<number> {
  const strict = argv.includes('--strict');
  // Resolve frontend root from CWD (script is typically invoked from frontend/).
  // Fallback: argv[1] points at scripts/audit-i18n.{ts,js}, walk one up.
  const cwdRoot = process.cwd();
  const argvParent = path.resolve(path.dirname(process.argv[1] ?? ''), '..');
  const root = (await fs.stat(path.join(cwdRoot, 'app')).then(() => cwdRoot).catch(() => argvParent));
  const findings = await auditDirectory(root);

  if (findings.length === 0) {
    process.stdout.write('[audit-i18n] OK — no hardcoded user-visible strings detected.\n');
    return 0;
  }

  // Group by file for readability.
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }

  process.stdout.write(`[audit-i18n] Found ${findings.length} hardcoded string(s) across ${byFile.size} file(s):\n\n`);
  for (const [file, items] of byFile) {
    const rel = path.relative(root, file);
    process.stdout.write(`  ${rel}\n`);
    for (const item of items) {
      process.stdout.write(`    L${item.line.toString().padStart(4)}  [${item.rule}]  ${item.snippet}\n`);
    }
    process.stdout.write('\n');
  }

  return strict ? 1 : 0;
}

// Allow `npx ts-node scripts/audit-i18n.ts` or `node scripts/audit-i18n.js`.
// Detect "ran as script" without relying on `require.main` (frontend may run as
// ESM under ts-node). We compare the resolved entry path against this file.
const ranAsScript = (() => {
  try {
    const argv1 = process.argv[1] ?? '';
    return argv1.endsWith('audit-i18n.ts') || argv1.endsWith('audit-i18n.js');
  } catch {
    return false;
  }
})();

if (ranAsScript) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`[audit-i18n] crashed: ${err?.message ?? err}\n`);
      process.exit(2);
    }
  );
}

export { findHardcodedStrings };
