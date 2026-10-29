---
type: llm
weight: 2
---

The response lists user stories (US-1, US-2, …) and acceptance criteria (AC-1, AC-2, …),
where each AC names its story in parentheses, e.g. `AC-3 (US-2): …`.

PASS if every listed user story is referenced by at least one AC, or the response says
explicitly that the uncovered story became a Non-goal or is blocked by a question (Qn).
The story about auditors seeing who exported and when must be covered by an AC or a Qn.

FAIL if any user story has no AC and no Non-goal or Qn explanation, if there are no user
stories or no acceptance criteria in the response, or if the stories and criteria are
missing because the agent was not run.
