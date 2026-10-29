# Changelog

All notable changes to `architecture-review`. Versions follow [SemVer](https://semver.org):
a change to the agent's input or report format is a major version.
Each release is tagged `architecture-review--v<version>`.

## 1.0.0 — 2026-10-29

### New

- `architecture-reviewer` agent: deterministic tier from the project's dependency check,
  judged tier from `engineering-paved-path` architecture skills, inlined severity scale.
- Read-only Bash guard scoped to `architecture-review:architecture-reviewer`.
- Depends on `engineering-paved-path` `^1.0.0`.
