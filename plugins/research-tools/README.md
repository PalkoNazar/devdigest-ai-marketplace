# research-tools

A read-only `researcher` agent that answers one concrete question with cited evidence. It
works in two modes: REPO (where and how something works in this codebase: code, docs,
specs, git history) and EXTERNAL (library and API docs, changelogs, issues, standards on
the web). It returns conclusions, evidence with `file:line` or links, and an explicit "not
found" list. A vague task gets clarifying questions back instead of a guess.

## Install

```
/plugin install research-tools@devdigest-ai
```

## Usage

Ask for it by name, or let Claude delegate a research question to it:

```
Use the research-tools:researcher agent: how does the retry policy for outgoing webhooks work?
```

## Safety

The agent has no Write or Edit tools. Its Bash is limited to read-only commands by a
`PreToolUse` hook (`hooks/readonly-bash.mjs`) that applies only to this agent: writes,
redirects, `git` commands other than read ones, package installs and interpreters are
blocked. The hook needs `node` on `PATH`.

## Layout

```
research-tools/
├── .claude-plugin/plugin.json
├── agents/researcher.md
├── hooks/hooks.json          # PreToolUse Bash guard for research-tools:researcher
├── hooks/readonly-bash.mjs
├── CHANGELOG.md
└── README.md
```
