# engineering-paved-path

Skills for the team's standard stack: React, Next.js App Router, Fastify, layered
architecture, React Testing Library and web security. Claude loads a skill when the task
touches its area, so code and reviews follow the same rules in every repository. The SDD
agents in `sdd-engineering` and `architecture-review` load these skills by name. No setup,
configuration or credentials needed.

## Install

```
/plugin install engineering-paved-path@devdigest-ai
```

## Skills

| Skill | Use it for |
| :- | :- |
| `engineering-paved-path:react-best-practices` | React components, hooks, state, anti-patterns |
| `engineering-paved-path:next-best-practices` | Next.js App Router: file conventions, RSC boundaries, data patterns, metadata, route handlers |
| `engineering-paved-path:react-testing-library` | Component and hook tests with Vitest + React Testing Library |
| `engineering-paved-path:fastify-best-practices` | Fastify routes, plugins, JSON Schema validation, errors, lifecycle |
| `engineering-paved-path:onion-architecture` | Backend layers (routes → service → ports → adapters), allowed imports, dependency injection |
| `engineering-paved-path:frontend-ui-architecture` | Where frontend code goes: components, hooks, helpers, constants, shared code, imports |
| `engineering-paved-path:security` | OWASP Top 10: auth, input handling, injection, uploads, secrets |

Skills load on their own when relevant. To load one explicitly, name it in the request
("use engineering-paved-path:security") or run it as `/engineering-paved-path:<skill>`.

## Adapting to a project

`onion-architecture` and `frontend-ui-architecture` describe a default layout. When a
project's `CLAUDE.md` or architecture docs describe its own layout, those win; write the
project's ring/folder mapping there so the skills apply it.

## Sources

`react-best-practices`, `next-best-practices`, `react-testing-library`,
`fastify-best-practices` and `security` were brought in from public skill collections;
`fastify-best-practices` is from `mcollina/fastify-best-practices` (see its `tile.json`)
and `security` builds on `agamm/claude-code-owasp` (see `skills/security/references.md`).
Upstream links and licenses for each are listed in [CHANGELOG.md](CHANGELOG.md) once
confirmed.

## Layout

```
engineering-paved-path/
├── .claude-plugin/plugin.json
├── skills/<skill>/SKILL.md   # plus references/ or rules/ per skill
├── CHANGELOG.md
└── README.md
```
