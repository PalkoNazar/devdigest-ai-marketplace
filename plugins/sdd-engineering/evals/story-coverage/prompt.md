---
description: spec-creator covers every user story with at least one acceptance criterion (1.1.0)
tags: [spec-creator, smoke]
# The plugin under test plus its dependencies: without them it fails to load (dependency-unsatisfied).
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
runs: 3
max_turns: 20
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Agent]
expected_outcome: A draft spec whose every US-n is referenced by an AC (or is a Non-goal or blocked by a Qn), and a report whose Self-check has a "Story coverage" line.
---

Use the `sdd-engineering:spec-creator` agent to write a first-draft spec for this feature
in this (empty) repository. Don't answer its questions; one round is enough.

Feature: CSV export of the orders list.
- An operator exports the orders currently shown on the Orders page (with the active
  filters) as a CSV file.
- An operator gets a clear message when there is nothing to export.
- An auditor can later see who exported orders and when.

When the agent is done, reply with three things, copied verbatim from what it wrote:
1. the spec's `## User stories` section,
2. the spec's `## Acceptance criteria (EARS)` section,
3. the `## Self-check` section of its report.
