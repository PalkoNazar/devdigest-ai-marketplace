---
description: spec-creator writes a draft spec with user stories and EARS acceptance criteria (every version since 1.0.0)
tags: [spec-creator, smoke]
# The plugin under test plus its dependencies: without them it fails to load (dependency-unsatisfied).
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
runs: 2
max_turns: 20
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Agent]
expected_outcome: "A draft spec with at least one US-n and EARS acceptance criteria written as AC-n (US-n) followed by one SHALL."
---

Use the `sdd-engineering:spec-creator` agent to write a first-draft spec for this feature
in this (empty) repository. Don't answer its questions; one round is enough.

Feature: a "Copy link" button on an article page.
- A reader copies the article's URL to the clipboard with one click.
- A reader sees a short confirmation that the link was copied.

When the agent is done, reply with two things, copied verbatim from what it wrote:
1. the spec's `## User stories` section,
2. the spec's `## Acceptance criteria (EARS)` section.
