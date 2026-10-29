# Spec: SDD Engineering and its dependency plugins

Status: Implemented on branch `sdd-engineering-plugins`
Scope: four plugins, 1.0.0 each, packaged from `PalkoNazar/dev-digest` `.claude/`

## 1. Goal

Ship the spec-driven development (SDD) workflow from DevDigest as installable plugins:
spec → plan → implement → verify → retro, usable in any repository, not only DevDigest.

The workflow lives in one plugin, `sdd-engineering`. The parts that are useful on their
own (the researcher, the architecture reviewer, the engineering skills) live in separate
plugins that `sdd-engineering` declares as dependencies, so a team can install them
without the whole workflow.

### Non-goals

- Product specs, plans and retros from DevDigest (`specs/`, `.claude/retros/`).
- Secrets, `settings.local.json`, caches.
- DevDigest-specific instructions: package names (`client/`, `server/`, `reviewer-core`),
  `pnpm arch:check`, `scripts/check.sh`, `@devdigest/shared`, `workspaceId` scoping.
- Agents other than the six in §2: `test-writer`, `correctness-reviewer` and `doc-writer`
  stay in DevDigest.
- Skills other than those in §4: `pr-self-review`, `engineering-insights`, `zod`,
  `typescript-expert`, `drizzle-orm-patterns`, `postgresql-table-design`,
  `mermaid-diagram`.

## 2. Plugins and dependency graph

```
sdd-engineering ──^1.0.0──▶ engineering-paved-path
               ├──^1.0.0──▶ research-tools
               └──^1.0.0──▶ architecture-review ──^1.0.0──▶ engineering-paved-path
```

| Plugin | Provides | Depends on |
| :- | :- | :- |
| `engineering-paved-path` | React, Next.js, Fastify, architecture, testing and security skills | — |
| `research-tools` | read-only agent `researcher` | — |
| `architecture-review` | generalized read-only agent `architecture-reviewer` | `engineering-paved-path` |
| `sdd-engineering` | agents `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`; skills `run-plan`, `workflow-retro` | all three above |

There are no cycles. `architecture-review` depends on `engineering-paved-path` because
its rules come from `onion-architecture` and `frontend-ui-architecture`.

## 3. Layout

```
plugins/
  engineering-paved-path/
    .claude-plugin/plugin.json
    README.md  CHANGELOG.md
    skills/
      react-best-practices/  next-best-practices/  react-testing-library/
      fastify-best-practices/  onion-architecture/  frontend-ui-architecture/
      security/
  research-tools/
    .claude-plugin/plugin.json
    README.md  CHANGELOG.md
    agents/researcher.md
    hooks/hooks.json  hooks/readonly-bash.mjs
  architecture-review/
    .claude-plugin/plugin.json
    README.md  CHANGELOG.md
    agents/architecture-reviewer.md
    hooks/hooks.json  hooks/readonly-bash.mjs
  sdd-engineering/
    .claude-plugin/plugin.json
    README.md  CHANGELOG.md
    agents/spec-creator.md  agents/implementation-planner.md
    agents/implementer.md   agents/plan-verifier.md
    skills/run-plan/SKILL.md
    skills/workflow-retro/SKILL.md  skills/workflow-retro/scripts/collect.mjs
    hooks/hooks.json  hooks/readonly-bash.mjs  hooks/spec-write-scope.mjs
    evals/
```

`readonly-bash.mjs` is copied into each plugin that needs it, because a plugin can only
run hook scripts from its own `${CLAUDE_PLUGIN_ROOT}`. CI checks that the copies are
byte-identical. The hook tests live outside the plugins, in `tests/hooks/`.

## 4. Shared skills: what goes where

Rule: a skill goes in the lowest plugin of the graph that needs it. Nothing is copied
between plugins; agents load it with the Skill tool by namespaced name
(`engineering-paved-path:security`). The `skills:` preload field is not used for skills
from another plugin: the docs don't say it accepts namespaced names.

| Skill (source) | Used by | Goes to |
| :- | :- | :- |
| `react-best-practices`, `next-best-practices`, `react-testing-library`, `fastify-best-practices` | implementer, planner (via routing) | `engineering-paved-path` |
| `onion-architecture`, `frontend-ui-architecture` | architecture-reviewer, planner, implementer | `engineering-paved-path`, generalized (§6) |
| `security` | implementer, plan-verifier, architecture-reviewer | `engineering-paved-path` |
| `sdd-run` | — | `sdd-engineering` as `run-plan` |
| `workflow-retro` | — | `sdd-engineering` |

Agents in DevDigest also lean on `pr-self-review` and `engineering-insights`, which are
not shipped. In the plugins:

- The file → skill routing table (`pr-self-review/references/routing.md`) moves into the
  `implementation-planner` prompt, cut down to the seven skills above with namespaced
  names. The planner writes the skills for each step into the plan; the implementer and
  plan-verifier take them from the plan.
- The severity scale (`pr-self-review/references/severity.md`) is inlined into the
  `architecture-reviewer` prompt.
- Reading and writing `INSIGHTS.md` is removed from the agents and from `run-plan`.

## 5. How the workflow runs

```
user request
  → spec-creator            draft spec, question rounds → user approves spec
  → implementation-planner  plan (reads code, assigns skills per step)
                            → user approves plan, picks multi- or single-agent mode
  → /sdd-engineering:run-plan <plan> [R1|all]
       per run: implementer
                → plan-verifier ∥ architecture-reviewer
                → fix rounds (max 2) → checks → commit
       after the last run: plan-verifier over the whole branch
  → /sdd-engineering:workflow-retro   optional, reads session transcripts
```

Compared with DevDigest's `sdd-run`, `run-plan` drops the `test-writer` (tests-first),
`correctness-reviewer`, `engineering-insights` and `doc-writer` steps; the implementer
writes the tests the plan lists.

`researcher` is called by spec-creator and the planner when they need cited facts.
`sdd-engineering/README.md` describes this flow with a diagram, the inputs each agent
expects, what each one may write, and how to start (`/plugin install
sdd-engineering@devdigest-ai` pulls the dependencies).

## 6. Generalizing the DevDigest sources

| DevDigest-specific | In the plugin |
| :- | :- |
| `specs/`, `<pkg>/specs/`, `specs/plans/*.plan.md` | Explicit inputs: spec path and plan path come from the caller. Defaults `specs/` and `specs/plans/` when not given |
| `scripts/check.sh`, `pnpm arch:check`, package typecheck/test commands | The plan's "Verification commands" section, written by the planner from the project's `CLAUDE.md`, `package.json` and CI files. Agents run only what the plan lists |
| `client/`, `server/src`, `reviewer-core`, `@devdigest/shared` | Removed. Architecture rules come from `onion-architecture` / `frontend-ui-architecture` and the project's own docs; dependency-cruiser is used when the project has a config, otherwise every finding is "judged" |
| `.claude/skills/<x>/scripts/...` | `${CLAUDE_SKILL_DIR}/scripts/...` |
| `$CLAUDE_PROJECT_DIR/.claude/hooks/*.mjs` | `${CLAUDE_PLUGIN_ROOT}/hooks/*.mjs` |
| skill names like `security` | `engineering-paved-path:security` |
| `.claude/retros/` | Default output dir for `workflow-retro`, overridable by argument |

## 7. Hooks

Plugin subagents ignore `hooks`, `mcpServers` and `permissionMode` in agent frontmatter.
The read-only and write-scope guards therefore move to each plugin's `hooks/hooks.json`
as `PreToolUse` hooks. Plugin hooks fire for every session, so each command passes the
agents it guards as arguments, and the script exits 0 for any other `agent_type` (the main
session has none). For plugin agents `agent_type` is namespaced, e.g.
`research-tools:researcher`:

| Hook | Matcher | Applies to |
| :- | :- | :- |
| `readonly-bash.mjs` | `Bash` | `research-tools:researcher`, `architecture-review:architecture-reviewer`, `sdd-engineering:spec-creator`, `sdd-engineering:implementation-planner`, `sdd-engineering:plan-verifier` |
| `spec-write-scope.mjs` | `Write\|Edit` | `sdd-engineering:spec-creator`: `*.md` directly in `specs/` or `<package>/specs/` |

`readonly-bash.mjs` no longer allows `scripts/check.sh`; package scripts (`npm test`,
`npm run typecheck`) stay allowed, so plans should list verification commands as package
scripts.

Tool allowlists (`tools` / `disallowedTools`) stay in the agent frontmatter as the first
line of defence. The catalog site's trust panel will list these hooks.

## 8. Versioning and release

- Each plugin starts at `1.0.0` in its `plugin.json` (`name`, `version`, `author`,
  `repository`, `license`).
- `sdd-engineering/plugin.json` declares `dependencies` on the three plugins with range
  `^1.0.0`; `architecture-review` declares `engineering-paved-path ^1.0.0`.
- Each plugin has its own `CHANGELOG.md` (Keep a Changelog sections: New / Changed /
  Fixed). The root `CHANGELOG.md` gets one line per plugin release linking to it.
- Four entries are added to `.claude-plugin/marketplace.json`, sorted by name, each with
  `name`, `source`, `description`, `category`, `tags`.
- A release is a commit on `main` plus a tag `<plugin>--v<version>` (e.g.
  `sdd-engineering--v1.0.0`). Claude Code resolves a dependency range to the highest
  matching tag, so every plugin release must be tagged, dependencies first.
- Breaking changes to an agent's inputs or outputs, or to a skill name another plugin
  calls, are a major version.

## 9. Open questions

1. Licenses and upstream sources: some skills are third-party (`fastify`, `next`,
   `react-testing-library`). Each needs its original repository, license and attribution
   in the plugin README before release. Links to come from the owner.
2. Evals: DevDigest has an `evals-example` branch. Which evals move to
   `sdd-engineering/evals/`, and in what format (`claude plugin eval`)?

## 10. Verified in the Claude Code docs

- `dependencies` entries are `"name"` or `{ "name", "version", "marketplace" }`; `version`
  is a node-semver range; a bare name resolves in the same marketplace; installing a
  plugin installs missing dependencies. `claude plugin validate --strict` accepts the
  object form (Claude Code 2.1.312).
- Plugin subagents ignore `hooks`, `mcpServers`, `permissionMode` (and `initialPrompt`).
- `PreToolUse` input carries `agent_type` inside a subagent; for plugin agents it is
  `<plugin>:<agent>`.
- `${CLAUDE_PLUGIN_ROOT}` resolves in hook commands and agent/skill markdown;
  `${CLAUDE_SKILL_DIR}` resolves in skill markdown.
- Not documented: namespaced names in an agent's `skills:` preload (not used, §4).

## 11. Done when

- `claude plugin validate --strict` passes for all four plugins and the marketplace.
- Installing `sdd-engineering` in an empty repository installs the three dependencies,
  and `/agents` lists all six agents.
- A full run in a sample repository (spec → plan → `run-plan` → retro) finishes with no
  reference to DevDigest paths, and the read-only agents are blocked from `rm` / `git
  commit` by the hooks.
- `grep -ri devdigest plugins/{sdd-engineering,research-tools,architecture-review,engineering-paved-path}`
  returns only README provenance lines.
- The catalog site lists all four plugins and their artifacts.
