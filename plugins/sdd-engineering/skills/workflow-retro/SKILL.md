---
name: workflow-retro
description: "Retrospective of a finished multi-agent workflow (a /sdd-engineering:run-plan, a spec → plan → implement → verify chain, a review/fix loop): collects facts from Claude Code's own session transcripts — tokens per agent and in total, which agents ran (plugin agents like sdd-engineering:implementer as well as project and built-in ones), in what order and in parallel, turns, tool calls, errors and hook blocks, files several agents read — then grades each agent (difficulties, what went easily, duplicated context, what it missed that a later agent, a PR reviewer, CI or the user caught) and the workflow as a whole, and proposes concrete changes to agent prompts and skills. Use when the user asks for a retro / ретроспектива / 'як пройшов workflow' / 'оціни агентів', or offer it at the end of /sdd-engineering:run-plan. Writes only the retro file and the retros index; changes to agents or skills only after the user picks them."
metadata:
  version: 1.0.0
  updated: 2026-10-29
---

# Workflow retro

Turns one finished workflow into a short, evidence-backed retro: numbers from the
transcripts, judgement from the conversation, and a list of changes to agents and
skills that the user can accept or reject. You apply only the changes the user picked
(Step 6), never on your own.

```
collect.mjs (facts) ─► read reports + conversation ─► grade agents + workflow ─► retro file ─► proposals (user decides)
```

Invocation: `/sdd-engineering:workflow-retro [--since <UTC time>] [--until <UTC time>]
[--session <id>] [<retros dir>]`. Retros go to `.claude/retros/` unless the user passes
another directory.

## Step 1 — Facts

```bash
node "${CLAUDE_SKILL_DIR}/scripts/collect.mjs" [--since <UTC time>] [--until <UTC time>] [--session <id>] [--project-dir <dir>]
```

- Default: the latest session of this project (the current directory, or the main
  worktree when run from a linked worktree; `--project-dir` points at another
  `~/.claude/projects/<project>` directory). A session often holds several workflows —
  pass `--since` (time of the user prompt that started this one, UTC, e.g.
  `2026-10-11T15:30`) so only this workflow is counted. Ask the user if the start is
  unclear.
- Prints: tokens (main / subagents / total, with cache write/read split and cache hit
  ratio), agents in launch order with parallel groups (`P1`, `P2`: same group = ran at
  the same time), duration, turns, SendMessage resumes, tool counts, errors and hook
  blocks, the final `Status:` of each agent, totals per agent type, MCP calls, files
  read by more than one participant, and the prompts the user typed.
- Agent types appear as Claude Code logs them: namespaced for plugin agents
  (`sdd-engineering:implementer`, `architecture-review:architecture-reviewer`) and bare
  for project or built-in agents (`general-purpose`). The JSON adds `plugin` and `name`
  for each agent.
- `--json` for the raw numbers. The script reads transcripts only; the only text it
  prints is short, redacted excerpts of tool errors and user prompts. Keep the retro the
  same way: no message bodies, no secrets, no pasted diffs.

Token numbers are what the API reported. Don't convert them to money unless the user
gives the prices — never guess a price.

## Step 2 — What happened

The numbers say how much; the conversation says why. Collect, with ids and file paths:

- Each agent's final report (in this conversation): its status, its findings, its
  "Not checked" / "Cannot verify" sections, and what the orchestrator did with them
  (fixed, dropped as false positive, deferred).
- Later sources that found something: the next reviewer agent, PR review comments
  (`gh api repos/<o>/<r>/pulls/<n>/comments` if the project uses GitHub), failing CI
  checks, and the user's corrections (the user-prompt list from Step 1 — "no, do…",
  "ні, роби…", "!!!", a repeated request).
- Fix rounds: how many, and what each round fixed.

## Step 3 — Grade each agent

One block per agent run (resumes of the same agent count as one run). Every claim
names its evidence: a number from Step 1, a finding id, a commit, a quote of ≤ 15 words.

| Question | Look at |
|---|---|
| **Outcome** — did its output get used? | status; findings fixed vs dropped; did the next step need to redo its work |
| **Difficulties** | errors and hook blocks (a blocked command = its prompt allows something its hook forbids, or it doesn't know the allowed form); `BLOCKED` / `INCOMPLETE`; resumes; turns close to its `maxTurns` |
| **Went easily** | few turns, no errors, first answer accepted — keep what made it so |
| **Duplicated context** | files it read that another agent or the main session also read (Step 1 list); the same facts restated in two reports; reading whole files where a section was enough |
| **Missed** (escaped defects) | anything a later agent, a PR reviewer, CI or the user found that was inside this agent's stated job. This is the most important row: name the item and where it was caught |
| **Over-reported** | findings dropped as false positives; style noise in a review that should report bugs only |
| **Instructions fit** | output format followed; scope respected; did it ask what it should have decided, or decide what it should have asked |

## Step 4 — Grade the workflow

- **Order and parallelism** — could two sequential agents have run in parallel (no
  data dependency), or did parallel ones step on each other? Time spent waiting for the
  user.
- **Rounds** — review/fix rounds and what each found; did rounds stop finding real bugs
  (time to stop)? Diminishing returns are a finding.
- **Cost shape** — where the tokens went (main vs subagents, cache-read heavy = long
  context re-sent; one agent dominating). Cost per accepted fix if it's easy to count.
- **Orchestration** — what the main session did by hand that a skill or agent should
  own; context passed to agents (too much, too little); user corrections — each one is
  something the setup should have known.

## Step 5 — Write the retro

`<retros dir>/YYYY-MM-DD-<slug>.md` (default `.claude/retros/`; create the folder if
missing), in the language of the request, then add one row to the table in
`<retros dir>/README.md` (create it with the header below if missing) so retros can be
compared over time.

```markdown
# Retro: <workflow> · YYYY-MM-DD
Session: `<id>` · Window: <from> → <to> UTC · Branch / PR: <…>

## Numbers
| Tokens total | Main | Subagents | Cache hit | Agents | Parallel groups | Fix rounds | User corrections | Wall time |
|---|---|---|---|---|---|---|---|---|

## Timeline
1. 15:06 sdd-engineering:implementer (P1) — 9 min, 26 turns → DONE
2. 15:16 sdd-engineering:plan-verifier ∥ architecture-review:architecture-reviewer (P2) → GAPS (G1–G2, fixed) · FINDINGS (A1, fixed)
3. …

## Agents
### sdd-engineering:plan-verifier
- Outcome: …
- Difficulties: …
- Went easily: …
- Duplicated: …
- Missed: … (caught by …)
- Over-reported: …

## Workflow
- Order / parallelism: …
- Rounds: …
- Cost shape: …
- Orchestration: …

## Proposed changes
| # | Target | Change | Why (evidence) | Expected effect | How to apply |
|---|---|---|---|---|---|
| C1 | `sdd-engineering:plan-verifier` (plugin agent) | … | … | … | report upstream / local override |
| C2 | `.claude/agents/my-agent.md` (project agent) | … | … | … | edit |
```

`<retros dir>/README.md` header (only when creating it):

```markdown
# Workflow retros
| Date | Workflow | Tokens total | Agents | Fix rounds | Escaped defects | User corrections | Retro |
|---|---|---|---|---|---|---|---|
```

### Where a proposed change goes

- **Plugin agents and skills** (a namespaced `<plugin>:<name>`, e.g. the agents and
  skills of `sdd-engineering`, `architecture-review`, `research-tools`,
  `engineering-paved-path`): never edit the installed plugin files — they are replaced
  on the next update. Offer two ways: (1) report it upstream to the plugin's marketplace
  repository (an issue with the change, the evidence and the expected effect — you
  draft the text, the user files it); (2) a local override: a project agent or skill
  under `.claude/agents/` / `.claude/skills/` with a new name that copies the plugin
  version plus the change, and the user's workflow calls that name instead. Prefer (1);
  (2) only when the user needs the change now.
- **Project agents, skills, hooks, `CLAUDE.md`** (bare names, files in this repository):
  edit them directly once the user accepts.
- **The workflow itself** (order, what the orchestrator passes): for `run-plan` it is a
  plugin skill — upstream or local override as above.

## Step 6 — Hand-off

- Show the user the Numbers row, the three most important proposals and the link to
  the retro file. Ask which proposals to apply (AskUserQuestion, multiSelect) — apply
  only those: project files as their own commit; plugin changes as drafted upstream
  issues or a local override, as the user picks.
- Keep it short. A retro nobody reads is waste: at most 3 bullets per agent field,
  at most 7 proposals.

## Rules

- Read-only, except the retro file, the retros README and (after the user picks them)
  the accepted changes. Never edit files of an installed plugin.
- No numbers without the script, no claims without evidence; "unknown" is fine.
- Never paste message bodies, diffs, secrets or keys into the retro.
- Grade the setup (prompts, skills, hooks, order), not the model's "effort".
