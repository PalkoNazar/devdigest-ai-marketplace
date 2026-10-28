# DevDigest AI Marketplace

A [Claude Code](https://code.claude.com) plugin marketplace.

## Add the marketplace

In a Claude Code session:

```
/plugin marketplace add PalkoNazar/devdigest-ai-marketplace
```

Or from the shell:

```bash
claude plugin marketplace add PalkoNazar/devdigest-ai-marketplace
```

The marketplace registers as `devdigest-ai`.

> Without a GitHub SSH key, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` so the clone uses HTTPS.

## Install a plugin

```
/plugin install <plugin>@devdigest-ai
```

## Plugins

| Plugin | Description |
| :- | :- |
| [hello-world](plugins/hello-world) | Example plugin with a single greeting skill |

## Get updates

Auto-update is off by default for third-party marketplaces. To turn it on, open `/plugin`,
go to **Marketplaces**, select `devdigest-ai`, and choose **Enable auto-update**.
To update manually, run `/plugin marketplace update devdigest-ai`.

## Share with a team

To register the marketplace for everyone in a project, run this in the project once and
commit the `.claude/settings.json` it writes:

```bash
claude plugin marketplace add PalkoNazar/devdigest-ai-marketplace --scope project
```

## Add a plugin

1. Create `plugins/<name>/` with `.claude-plugin/plugin.json`, its components
   (`skills/`, `agents/`, `hooks/hooks.json`, `.mcp.json`), and a `README.md`.
   Use `plugins/hello-world` as a template.
2. Add an entry to `.claude-plugin/marketplace.json` whose `name` matches the `name`
   in the plugin's `plugin.json`.
3. Validate and test locally:

   ```bash
   claude plugin validate ./plugins/<name>
   claude plugin validate . --strict
   claude plugin marketplace add ./
   claude plugin install <name>@devdigest-ai
   ```

4. Add an entry to `CHANGELOG.md`.

## Conventions

- **Names**: kebab-case. Don't start a name with `claude-` or `anthropic-`. Never change a
  published plugin's `name`; set `displayName` to change the label, or record the change in
  `renames` in `marketplace.json`.
- **Versions**: set `version` only in the plugin's `plugin.json`, never in its marketplace
  entry, and bump it on every release. Users don't receive commits until it changes.
- **Paths**: inside a plugin, reference bundled files as `${CLAUDE_PLUGIN_ROOT}/...` and
  keep state in `${CLAUDE_PLUGIN_DATA}`. Don't reference files outside the plugin directory.
- **Executables**: keep scripts in `scripts/`, not a top-level `bin/`.
- **Files**: no Git LFS — clones only get pointer files.

## Catalog site

[`site/`](site) is a static catalog of everything in this marketplace, with search, a
trust panel per plugin and a settings generator for teams. See [`site/README.md`](site/README.md).

## License

[MIT](LICENSE)
