# Cost baseline: sdd-engineering

How much one successful `sdd-engineering` workflow costs, what one optimization changed,
and the quality gate it had to pass.

## Metric

**Cost per successful workflow** = (agent cost + LLM-judge cost of all runs) ÷ runs that
passed. A run passes when every scored grader of its case passes. Failed runs stay in the
numerator: their cost is part of what a success costs.

## Setup

| | |
| :- | :- |
| Date | 2026-10-29, both arms started together (13:36 UTC) |
| Claude Code | 2.1.312 |
| Code | `main` at `47e41ce` (sdd-engineering 1.1.0, dependencies 1.0.0) |
| Cases | `smoke` (2 runs), `story-coverage` (3 runs), from `plugins/sdd-engineering/evals/` |
| Judge | default (`haiku`), 3 votes per LLM grader |

Both arms ran the same command from `plugins/`:

```bash
claude plugin eval . --eval-dir sdd-engineering/evals --ablation none --allow-tools Write Edit
```

`--allow-tools Write Edit` lets `spec-creator` write the spec file, as it does in a real
project. `--ablation none` skips the no-plugin arm, which this measurement doesn't need.

## Baseline: `spec-creator` on `opus`

| Case | Passed | Cost | Avg time |
| :- | :- | :- | :- |
| smoke | 1/2 | $0.672 | 78 s |
| story-coverage | 3/3 | $1.533 | 140 s |
| **Total** | **4/5** (score 0.875) | **$2.205** | 115 s |

**Cost per successful workflow: $0.551**

## Optimization: `spec-creator` on `sonnet`

`spec-creator` drafts a spec from a short request and asks questions; it doesn't plan or
write code. It moved from `model: opus` to `model: sonnet`, keeping `effort: high`. No
other agent changed: `implementation-planner` and `plan-verifier` stay on `opus`.

| Case | Passed | Cost | Avg time |
| :- | :- | :- | :- |
| smoke | 1/2 | $0.482 | 61 s |
| story-coverage | 3/3 | $0.886 | 86 s |
| **Total** | **4/5** (score 0.875) | **$1.368** | 76 s |

**Cost per successful workflow: $0.342** (−38%), and 34% faster per run.

## Quality gate

An optimization ships only if, on the same cases run at the same time as the baseline:

1. `story-coverage` passes every run (the 1.1.0 behaviour), **and**
2. the overall score is not lower than the baseline's.

| Gate | Baseline | Sonnet | Result |
| :- | :- | :- | :- |
| story-coverage | 3/3 | 3/3 | ✅ |
| Overall score | 0.875 | 0.875 | ✅ |

Gate passed; the change ships as sdd-engineering 1.1.1.

## Known issue found by the baseline

Each arm failed one `smoke` run on the `spec-shape` grader, for the same reason: one
acceptance criterion had two SHALLs (baseline `AC-14`: "… SHALL NOT rely on colour
alone; it SHALL include text"; sonnet `AC-13`). `spec-creator`'s own Step 5 requires one
SHALL per AC, so the grader is right and the defect is in the agent, independent of the
model. It's left for a separate fix; until then the baseline score is 0.875, not 1.0.

## Limits

- Five runs per arm. The cost difference is large and consistent run by run (every sonnet
  run was cheaper than every opus run of the same case), but the pass rates (4/5 vs 4/5)
  can't separate small quality differences.
- The cases exercise `spec-creator` only. The other agents' cost isn't measured here.
- Eval costs are API-equivalent USD as reported by `claude plugin eval`.

## Re-measure

Run the command above on two checkouts (before and after a change) at the same time, then
divide each JSON result's run costs (`costUsd + judgeCostUsd`) by its passed runs. Add the
new numbers here as a new section; keep the old ones.
