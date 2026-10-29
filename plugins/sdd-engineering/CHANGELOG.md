# Changelog

All notable changes to `sdd-engineering`. Versions follow [SemVer](https://semver.org):
a change to the plan format, an agent's input or report format, or a dependency's major
version is a major version. Each release is tagged `sdd-engineering--v<version>`, after
the tags of the dependency versions it needs.

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
