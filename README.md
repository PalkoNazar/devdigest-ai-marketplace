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
| [architecture-review](plugins/architecture-review) | Read-only architecture reviewer agent |
| [engineering-paved-path](plugins/engineering-paved-path) | React, Next.js, Fastify, architecture, testing and security skills |
| [hello-world](plugins/hello-world) | Example plugin with a single greeting skill |
| [research-tools](plugins/research-tools) | Read-only researcher agent with cited evidence |
| [sdd-engineering](plugins/sdd-engineering) | Spec-driven development: spec → plan → implement → verify → retro. Installs the three plugins above as dependencies |

## Get updates

Auto-update is off by default for third-party marketplaces. To turn it on, open `/plugin`,
go to **Marketplaces**, select `devdigest-ai`, and choose **Enable auto-update**.
To update manually, run `/plugin marketplace update devdigest-ai`.

## Release channels

| Channel | Branch | Marketplace name | Add it with |
| :- | :- | :- | :- |
| latest | `main` | `devdigest-ai` | `PalkoNazar/devdigest-ai-marketplace` |
| stable | `stable` | `devdigest-ai-stable` | `PalkoNazar/devdigest-ai-marketplace#stable` |

`stable` holds only releases that passed their evals; today that is `sdd-engineering`
1.0.0 with its 1.0.0 dependencies. A release reaches `stable` after its eval suite is
green on `main`: fast-forward or merge the release commit into `stable`, keeping
`name: devdigest-ai-stable` in its `marketplace.json`.

To roll a project back to the stable release, swap the marketplace and the plugin ids:

```bash
claude plugin marketplace add PalkoNazar/devdigest-ai-marketplace#stable --scope project
claude plugin uninstall sdd-engineering@devdigest-ai --scope project --prune -y
claude plugin install sdd-engineering@devdigest-ai-stable --scope project
```

`--prune` also removes the `@devdigest-ai` copies of the three dependencies. Without it they
stay enabled next to the `@devdigest-ai-stable` ones, and their skills and agents load twice.
`-y` confirms the removal when the shell is not interactive.

Each release is also tagged `<plugin>--v<version>` (for example `sdd-engineering--v1.1.0`);
dependency version ranges resolve against these tags.

## Check the active version

Claude Code logs an OpenTelemetry event, `claude_code.plugin_loaded`, for every enabled
plugin at session start. Its `plugin.version` comes from the plugin's `plugin.json`, so it
shows which version and channel a session actually loaded. For third-party plugins the
name and version are redacted unless `OTEL_LOG_TOOL_DETAILS=1` is set.

Run this in the project, with no collector needed (one short haiku request):

```bash
CLAUDE_CODE_ENABLE_TELEMETRY=1 OTEL_LOGS_EXPORTER=console OTEL_METRICS_EXPORTER=none OTEL_LOG_TOOL_DETAILS=1 \
  claude -p "Reply with just: ok" --model haiku --max-turns 1 2>&1 \
  | grep -A8 '"plugin_loaded"' | grep -E '"(plugin\.name|marketplace\.name|plugin\.version)"' | paste - - - | grep devdigest
```

After a rollback to the stable channel it prints, among others:

```
"plugin.name": "sdd-engineering"   "marketplace.name": "devdigest-ai-stable"   "plugin.version": "1.0.0"
```

To send the same events to a collector instead, set `OTEL_LOGS_EXPORTER=otlp` and
`OTEL_EXPORTER_OTLP_ENDPOINT`; see [Monitoring](https://code.claude.com/docs/en/monitoring-usage).
`claude plugin list --json` shows what is installed; this event shows what a session loaded.

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

4. Add a `CHANGELOG.md` in the plugin and a line to the root `CHANGELOG.md`.
5. After merging to `main`, tag the release `<plugin>--v<version>`. Plugins that depend
   on it resolve version ranges against these tags.

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
