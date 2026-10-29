# Changelog

All notable changes to `sdd-engineering`. Versions follow [SemVer](https://semver.org):
a change to the plan format, an agent's input or report format, or a dependency's major
version is a major version. Each release is tagged `sdd-engineering--v<version>`, after
the tags of the dependency versions it needs.

## 1.1.1 — 2026-10-29

Backward-compatible: no change to any agent's input, output or report format.

### Changed

- `spec-creator` runs on `model: sonnet` instead of `opus` (`effort: high` unchanged).
  Cost per successful eval run drops from $0.551 to $0.342 (−38%) at the same score; see
  [docs/COST-BASELINE.md](../../docs/COST-BASELINE.md).

## 1.1.0 — 2026-10-29

Backward-compatible: the spec template, the plan format and all agent inputs are unchanged.

### New

- `spec-creator` checks story coverage: every user story is referenced by at least one
  acceptance criterion, or becomes a Non-goal, or is blocked by a question. Its report's
  Self-check gains a `Story coverage:` line.
- First eval suite, `evals/story-coverage/`: runs `spec-creator` on a three-story feature
  and checks that every story is covered. Run it with
  `cd plugins && claude plugin eval . --eval-dir sdd-engineering/evals --allow-tools Write Edit`
  (run from `plugins/`, so the dependencies listed in the case can load).

## 1.0.0 — 2026-10-29

First release, packaged from the DevDigest project's agents and skills and made
project-agnostic.

### New

- Agents `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`.
- Skill `run-plan` (was `sdd-run` in DevDigest): implementer → plan-verifier ∥
  architecture-reviewer → up to two fix rounds → full check → commit, per run.
- Skill `workflow-retro` with `scripts/collect.mjs`; recognises plugin agent types
  (`plugin:agent`) and adds per-agent-type totals.
- Hooks `readonly-bash.mjs` and `spec-write-scope.mjs` in `hooks/hooks.json`, scoped by
  `agent_type`.
- Dependencies: `engineering-paved-path`, `research-tools`, `architecture-review`, each
  `^1.0.0`.

### Changed from DevDigest

- Paths and commands come from the project (`CLAUDE.md`, `package.json`, CI) and from
  explicit inputs, not from DevDigest's layout.
- Skills are loaded by namespaced name (`engineering-paved-path:<skill>`); the file → skill
  routing table lives in the planner.
- Not included: `test-writer`, `correctness-reviewer`, `doc-writer` agents;
  `pr-self-review` and `engineering-insights` skills. The implementer writes the tests the
  plan lists.
