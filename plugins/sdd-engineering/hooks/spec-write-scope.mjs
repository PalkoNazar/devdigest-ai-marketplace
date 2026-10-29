#!/usr/bin/env node
// PreToolUse hook (matcher: Write|Edit) for the spec-creator agent. Claude Code has no
// path-scoped Write, so this hook is the write scope: a spec file directly inside
// `specs/` or `<package>/specs/`, `*.md`, not a README, and — if it already exists —
// still a draft. Sub-folders (`specs/plans/`, `<package>/specs/designs/`) are outside.
// Plugin hooks fire for every session, so the agents it guards are passed as arguments
// (`spec-write-scope.mjs sdd-engineering:spec-creator`) and other calls pass through.
// The file the call produces must still say `Status: draft` (once, in its header):
// approval is the user's call. Exit 2 blocks the call and shows stderr to the agent.
// Test: node tests/hooks/spec-write-scope.test.mjs

import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// `specs` or `<package>/specs`, one level deep. Test folders (`e2e/specs`) hold test files, and
// `specs/specs` is a sub-folder of specs/, not a package.
const NOT_PACKAGES = new Set(['e2e', 'test', 'tests', 'node_modules', '.git', 'specs']);
const isSpecDir = (dir) => {
  const m = /^(?:([^/]+)\/)?specs$/.exec(dir);
  return Boolean(m) && !NOT_PACKAGES.has(m[1]);
};
const HEADER_LINES = 5;

const lexists = (p) => {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

// Resolves symlinks of the deepest existing ancestor, so a linked folder can't
// smuggle a write out of the repo. `lstat`, not `exists`: a dangling link is an
// existing entry, and realpathSync throws on it instead of pretending it's new.
function realish(p) {
  let head = p;
  const tail = [];
  while (!lexists(head)) {
    tail.unshift(path.basename(head));
    const up = path.dirname(head);
    if (up === head) return p;
    head = up;
  }
  return path.join(realpathSync(head), ...tail);
}

// The header must carry exactly one Status field, and it must be `draft`.
function isDraft(text) {
  const head = text.split('\n').slice(0, HEADER_LINES).join('\n');
  // A field starts a line or follows a `|`/`·` separator — `NotStatus:` is not one.
  const statuses = [...head.matchAll(/(?:^|[|·])[ \t]*Status:[ \t]*([^\s|·]*)/gim)].map((m) => m[1].toLowerCase());
  return statuses.length === 1 && statuses[0] === 'draft';
}

// Content of the file after the call, the way the Edit tool would produce it.
function resultingContent(ti, current) {
  if (typeof ti.content === 'string') return ti.content;
  if (typeof ti.old_string !== 'string' || typeof ti.new_string !== 'string') return null;
  if (current === null || !current.includes(ti.old_string)) return current;
  return ti.replace_all ? current.split(ti.old_string).join(ti.new_string) : current.replace(ti.old_string, () => ti.new_string);
}

/**
 * @param {{ tool_name?: string, tool_input?: Record<string, unknown> }} input
 * @param {string} root repo root (CLAUDE_PROJECT_DIR)
 * @returns {string | null} reason to block, or null to allow
 */
export function check(input, root) {
  const ti = input.tool_input ?? {};
  const filePath = typeof ti.file_path === 'string' ? ti.file_path : '';
  if (!filePath) return 'no file_path';

  const realRoot = realish(path.resolve(root));
  const given = path.resolve(realRoot, filePath);
  if (lexists(given) && lstatSync(given).isSymbolicLink()) return `${filePath} is a symlink — specs are regular files`;
  let target;
  try {
    target = realish(given);
  } catch {
    return `${filePath} goes through a broken symlink`;
  }
  const rel = path.relative(realRoot, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return `${filePath} is outside the repo`;

  const dir = path.dirname(rel).split(path.sep).join('/');
  if (!isSpecDir(dir)) return `${rel} is not directly inside specs/ or <package>/specs/`;
  const base = path.basename(rel);
  if (!base.endsWith('.md')) return `${rel} is not a .md file`;
  if (base.toLowerCase() === 'readme.md') return 'spec folder READMEs are not specs';

  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (current !== null && !isDraft(current)) {
    return `${rel} is not a draft — write a new spec with "Supersedes:" instead of editing it`;
  }
  const next = resultingContent(ti, current);
  if (next === null) return 'cannot tell what the file will contain';
  if (!isDraft(next)) return 'the spec header must keep exactly one `Status: draft` — only the user approves';
  return null;
}

// Compare real file URLs: a raw `file://${argv[1]}` misses on paths with spaces or on
// Windows, and a missed check here would let every write through.
const isMain = () => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
};

if (isMain()) {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0); // not our input shape — let the normal permission flow decide
  }
  const agents = process.argv.slice(2);
  if (agents.length && !agents.includes(input.agent_type)) process.exit(0);
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const reason = check(input, root);
  if (reason) {
    process.stderr.write(
      `Blocked by spec write scope: ${reason}. spec-creator writes only draft specs ` +
        `(*.md directly in specs/ or <package>/specs/); report anything else to the calling session.\n`,
    );
    process.exit(2);
  }
}
