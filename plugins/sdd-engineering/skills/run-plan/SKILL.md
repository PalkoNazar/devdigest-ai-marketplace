---
name: run-plan
description: "Executes an approved Development Plan (default location specs/plans/*.plan.md) end to end as the orchestrating main session: picks the worktree and branch, then per run sdd-engineering:implementer → sdd-engineering:plan-verifier ∥ architecture-review:architecture-reviewer → fix rounds (max 2) → the plan's full check → commit; after the last run a whole-branch verification and a smoke check, then offers /sdd-engineering:workflow-retro. Use when the user says 'execute / run / implement the plan', 'виконай план', 'реалізуй план', starts a new chat with a plan path, or types /sdd-engineering:run-plan <plan> [R1|all]. Not for writing specs (sdd-engineering:spec-creator) or plans (sdd-engineering:implementation-planner)."
metadata:
  version: 1.0.0
  updated: 2026-10-29
---

# Run plan — execute a plan with the agents

You are the **orchestrator**. Agents do the work; you route their reports, ask the
user, run the cheap deterministic checks and commit. You never edit production code
or tests yourself — a fix goes back to the agent that owns it.

```
sdd-engineering:spec-creator → sdd-engineering:implementation-planner → [this skill]
  per run:  sdd-engineering:implementer
            → sdd-engineering:plan-verifier ∥ architecture-review:architecture-reviewer
            → fixes (≤ 2 rounds) → the plan's full check → commit
  at end:   plan-verifier (all) → smoke → commit → user: review, push, PR
            → offer /sdd-engineering:workflow-retro
```

Invocation: `/sdd-engineering:run-plan <plan path> [R<n> | all]`. The plan path is
required; the run defaults to the first run without a commit (see Step 0). `all` runs
every remaining run in order.

The implementer writes the tests the plan lists together with the code — there is no
separate tests-first step.

## Step 0 — Preconditions

1. Read the plan header. `Status` must be `ready`. `Execution:` must be
   `multi-agent` or `single-agent`; `ask-user` or missing → ask the plan's
   **Execution mode** question with AskUserQuestion and write the answer into the
   plan's header line (the plan file is the only state between chats).
2. Read the plan's **Verification commands** section: the per-step quick check and the
   per-run full check (a run's "Ends green on" command). If the plan lists none, find
   the project's checks (`CLAUDE.md` / `AGENTS.md`, `package.json` scripts, CI config),
   tell the user which commands you will use, and use them for every run.
3. Base branch: the repository's default branch (`git symbolic-ref
   refs/remotes/origin/HEAD`, fallback `main`). Plan branch: the plan's `Branch:` line.
   Which runs are done: `git log --oneline <base>..<plan branch>` — commit subjects end
   in `(R<n>)`. Start at the first run without one.
4. **Worktree.** The user often runs two sessions on one clone. Check
   `git worktree list` and `git status --short` in the current clone. If the tree is
   dirty or another session may be working there, do the whole run in a worktree:
   `git worktree add ../<repo>-<slug> -b <plan branch> <base>` (or the existing
   branch without `-b`), install the dependencies there the way the project's README /
   `CLAUDE.md` says (lockfile-based install), and work from that directory — agents run
   in the session's working directory. Otherwise switch to (or create) the plan branch
   in place. Never `git stash`.
5. Note the spec path from the plan header — the reviewers need it.

## Step 1 — One run (multi-agent)

Keep prompts short and self-contained: plan path, run id, the spec path and the
**sections** of earlier reports an agent needs — never paste whole reports around.

1. **Implement.** `sdd-engineering:implementer`: `Plan: <path> · Run: R<n>`. Keep its
   agent id — fix rounds go back to the same implementer via SendMessage, it still has
   the context.
   - `BLOCKED` → show the conflict; a plan change goes to
     `sdd-engineering:implementation-planner` (resume with the conflict), then back here.
   - `PARTIAL` → show the failing output, ask: fix round / replan / stop.
2. **Scope check.** `git status --short`: every changed file must be in the
   implementer's "Files changed". Anything else → ask before going on.
3. **Review — two agents in ONE message (parallel):**
   - `sdd-engineering:plan-verifier`: `Plan: <path> · Scope: R<n>` + the
     implementer's sections "Files changed", "Deviations from plan".
   - `architecture-review:architecture-reviewer`: `DIFF · Base: <base>` + plan path +
     the implementer's "For reviewers".
4. **Triage** into one list, then route:

   | Source | What | Goes to |
   |---|---|---|
   | plan-verifier | `G<n>` gaps, unplanned changes, missing tests the plan lists | implementer |
   | architecture-reviewer | `A<n>` critical / major | implementer |
   | any | minor / nit / Optional / FYI | not fixed — listed in the run summary |
   | any | `Plan issues` | the user; a real plan gap → implementation-planner |

   A finding the user rejects is dropped, not argued.
5. **Fix rounds — at most 2.** Send the routed items (ids + the finding text) to the
   implementer (SendMessage to the same agent, or a new call with the plan path, run id
   and the gap list). Then re-check only what was fixed: `plan-verifier` with
   `Re-verify: G1, G3` (resume it via SendMessage, or a new call with its previous
   report), `architecture-reviewer` only if an `A` finding was fixed. Still open after
   round 2 → AskUserQuestion: one more round / accept as known issue (goes into the
   commit body) / stop.
6. **Checks.** Run the run's full check from the plan yourself (deterministic). Red →
   back to the implementer; a run is never committed red.
7. **Commit** on the plan branch: `feat(<scope>): <run title> (R<n>)` (or `fix`/
   `chore` from the branch prefix), body = what the run delivered + accepted known
   issues, with the attribution lines. Never push, never open a PR.
8. **Run summary** to the user (short): steps done, checks, findings fixed /
   dropped / open, minor items not fixed. Ask before starting the next run only if
   something is open; otherwise continue.

## Step 1' — Single-agent mode

One `sdd-engineering:implementer` call with `Run: all runs` (it owns every check in
this mode and records the commands and exit codes). Then the plan's full check yourself
and `git status --short` against its "Files changed". Then `plan-verifier` with
`Scope: all` ∥ `architecture-reviewer` with `DIFF · Base: <base>` over the whole branch;
route their findings as in Step 1.4–1.5. Checks → commit. Then continue with Step 2.2
(the whole-branch verification is already done).

## Step 2 — After the last run

1. `sdd-engineering:plan-verifier` with `Scope: all` — the whole plan over the whole
   branch; catches a later run that broke an earlier one. Gaps → one fix round as in
   Step 1.4–1.5, then finish it like a run: Step 1.6 (the full check) and 1.7 (its own
   commit, `fix(<scope>): close whole-branch verification gaps`) — before the smoke
   check.
2. **Smoke.** The plan's `Smoke:` line under Verification (no such line: the spec's
   main user story). If the app is already running, do it yourself on real data via its
   API, UI or CLI; otherwise give the user the exact steps and wait. Never start, stop
   or reset databases, containers or shared environments without the user's go-ahead.
   If the smoke check depends on processes that don't hot-reload the changed code, ask
   the user to restart them first. A smoke failure is a finding → Step 1.4.
3. Set the spec's `Status: implemented` only if the user confirms.
4. Hand-off: branch name, commits, open known issues, and next steps for the user:
   review the branch, then push and open the PR themselves. If you worked in a
   worktree, offer to remove it (clean, committed) and check the branch out in the main
   clone.
5. Offer `/sdd-engineering:workflow-retro --since <time of the prompt that started this
   run>`: tokens, agent order, what each agent missed, proposed prompt/skill changes.

## Stop and ask the user when

- an agent returns `BLOCKED`, `needs-clarification`, `cannot-start` or `INCOMPLETE`
  twice;
- a fix round would change a file outside the plan;
- a finding asks to change the spec's behaviour (**what**) — that's
  `sdd-engineering:spec-creator`;
- two agents contradict each other (e.g. plan-verifier vs architecture-reviewer on the
  same file).
