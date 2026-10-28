# hello-world

Example plugin for the DevDigest AI marketplace. It adds one skill, `hello`, that greets
you and confirms the marketplace and plugin are installed correctly. It needs no setup,
configuration or credentials. Copy this directory as a template when you add a new plugin
to the marketplace.

## Install

```
/plugin install hello-world@devdigest-ai
```

## Usage

```
/hello-world:hello
```

## Layout

```
hello-world/
├── .claude-plugin/plugin.json   # manifest — the only file inside .claude-plugin/
├── skills/hello/SKILL.md        # one directory per skill
└── README.md
```
