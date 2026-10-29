# architecture-review

A read-only `architecture-reviewer` agent that checks a branch diff or named paths against
the project's layer and import rules. It reviews in two tiers: deterministic findings from
the project's dependency check (for example dependency-cruiser) when one is configured, and
judged findings from the `onion-architecture` and `frontend-ui-architecture` skills plus
the project's own architecture docs. Every finding has evidence (command output or a
`file:line` quote), a severity and its tier. It never edits files.

## Install

```
/plugin install architecture-review@devdigest-ai
```

This also installs `engineering-paved-path`, which holds the architecture skills.

## Usage

```
Use the architecture-review:architecture-reviewer agent on this branch against main.
```

In `sdd-engineering`, `/sdd-engineering:run-plan` runs it after every implementer run.

## Safety

The agent has no Write or Edit tools. Its Bash is limited to read-only commands by a
`PreToolUse` hook (`hooks/readonly-bash.mjs`) that applies only to this agent. The hook
needs `node` on `PATH`.

## Layout

```
architecture-review/
├── .claude-plugin/plugin.json   # depends on engineering-paved-path ^1.0.0
├── agents/architecture-reviewer.md
├── hooks/hooks.json
├── hooks/readonly-bash.mjs
├── CHANGELOG.md
└── README.md
```
