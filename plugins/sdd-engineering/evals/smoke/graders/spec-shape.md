---
type: llm
weight: 2
---

PASS if the response has a user stories section with at least one story (US-1, …) and an
acceptance criteria section where every AC names its story in parentheses, e.g.
`AC-2 (US-1): …`, uses an EARS form (WHEN / IF … THEN / WHILE / WHERE, or an
unconditional "The … SHALL …") and has exactly one SHALL.

FAIL if either section is missing or empty, if an AC has no SHALL or more than one, or if
the sections are missing because the agent was not run.
