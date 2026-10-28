# Spec: DevDigest AI catalog site

Status: Draft
Scope: MVP + settings generator + trust panel

## 1. Goal

A static site on GitHub Pages where users of the `devdigest-ai` marketplace can:

- find any plugin, skill, agent, command, hook or MCP server in this repository by
  typing what they need ("I need a skill for reviewing pull requests"),
- see what an artifact does and how to install and invoke it,
- see what a plugin runs on their machine before they install it,
- generate a `.claude/settings.json` that enables a chosen set of plugins for a team,
- ask for a skill that doesn't exist yet.

There is no backend. Everything the site shows is extracted from the repository at build
time; everything interactive runs in the browser.

### Non-goals

- Install counts, ratings, comments or any other data that needs a server.
- Accounts or sign-in.
- Executing or testing plugins.
- Localization. The UI is English only.

## 2. Users and key flows

| User | Flow |
| :- | :- |
| Developer looking for a capability | Types a request on the home page → sees matching artifacts as cards → opens one → copies the install command |
| Developer deciding whether to trust a plugin | Opens a plugin page → reads the trust panel (hooks, MCP servers, config, executables) |
| Team lead | Opens Setup → picks plugins → copies the generated `.claude/settings.json` into the team's repository |
| New user | Opens Getting started → adds the marketplace, configures git access, turns on auto-update |
| Anyone with no match | Gets "Nothing found" → clicks "Request a skill" → a prefilled GitHub issue opens |

## 3. Architecture

```
push to main
  └─ .github/workflows/pages.yml
       1. claude plugin validate . --strict        (fail fast on a broken catalog)
       2. site/scripts/build-catalog.ts            (repo → catalog.json)
       3. astro build                              (catalog.json → static pages + search index)
       4. actions/deploy-pages
```

- **Location**: everything lives in `site/` in this repository. The build reads plugin
  files from the repository root (`..` relative to `site/`).
- **Framework**: Astro, static output (`output: "static"`). Pages are generated per plugin
  and per artifact. Interactive parts (search, setup generator, copy buttons) are small
  islands in plain TypeScript or Preact; no React runtime.
- **Search**: [MiniSearch](https://github.com/lucaong/minisearch) in the browser, over a
  prebuilt serialized index.
- **Base URL**: `https://palkonazar.github.io/devdigest-ai-marketplace/`. Astro `site` and
  `base` are set accordingly; every internal link goes through `base`.
- **No runtime network calls** other than loading the site's own files. No analytics, no
  third-party fonts or CDNs.

## 4. Catalog extraction (`build-catalog.ts`)

### 4.1 Inputs

For each entry in `.claude-plugin/marketplace.json` whose `source` is a relative path:

| File | Extracted |
| :- | :- |
| marketplace entry | `name`, `displayName`, `description`, `category`, `tags`, `dependencies` |
| `.claude-plugin/plugin.json` | `name`, `displayName`, `version`, `description`, `author`, `homepage`, `license`, `keywords`, `dependencies`, `userConfig`, inline `hooks` / `mcpServers`, component path overrides, `metadata.catalog` (§4.4) |
| `skills/<name>/SKILL.md` (+ dirs from `skills` key) | frontmatter `name`, `description`; Markdown body |
| `agents/*.md` (or `agents` key) | frontmatter `name`, `description`, `tools`, `model`; body |
| `commands/*.md` (or `commands` key) | file name, frontmatter `description`, `argument-hint`, `allowed-tools`; body |
| `hooks/hooks.json` (+ `hooks` key) | per event: matcher, hook type, command / args |
| `.mcp.json` (+ `mcpServers` key) | per server: name, transport, `command` + `args` or `url`, `env` keys |
| `bin/` | file names |
| `monitors/monitors.json` (+ `experimental.monitors`) | name, command, description, `when` |
| `CHANGELOG.md` (repo root) | latest entry per plugin (`## <plugin> <version>` heading) |
| `README.md` (plugin root) | body, for the plugin page |

Component path resolution follows Claude Code's rules: `commands`, `agents`,
`outputStyles` in the manifest **replace** the default folder; `skills` **adds** to
`skills/`; `hooks` and `mcpServers` **merge** with the default file. Entries with a
non-relative `source` (`github`, `git-subdir`, …) are listed with entry metadata only and
marked "external — details available after install".

Anything the extractor can't parse is a build **error**, not a silent skip: the catalog
must never show less than the repository contains.

### 4.2 Output: `catalog.json`

```ts
type Catalog = {
  marketplace: { name: string; description: string; repo: string; owner: string };
  generatedAt: string;            // ISO timestamp
  commit: string;                 // git SHA the site was built from
  plugins: Plugin[];
  artifacts: Artifact[];
};

type Plugin = {
  name: string;
  displayName?: string;
  version?: string;
  description: string;
  category?: string;
  tags: string[];
  keywords: string[];
  author?: { name: string; url?: string };
  license?: string;
  homepage?: string;
  dependencies: string[];          // normalized to "name@marketplace"
  external: boolean;               // non-relative source
  readmeHtml?: string;             // sanitized
  latestChange?: { version: string; html: string };
  trust: Trust;                    // §7
  artifactIds: string[];
};

type ArtifactType = "skill" | "agent" | "command" | "hook" | "mcp" | "monitor";

type Artifact = {
  id: string;                      // "<plugin>/<type>/<name>"
  type: ArtifactType;
  plugin: string;
  name: string;
  description: string;
  keywords: string[];              // from metadata.catalog, §4.4
  invocation?: string;             // "/hello-world:hello" for skills and commands, "hello-world:reviewer" for agents
  bodyHtml?: string;               // sanitized; omitted when publishContent = "metadata"
  bodyText?: string;               // plain text for search, first 2,000 characters
  sourcePath: string;              // repo-relative, for "View source" links
};
```

Two files are emitted:

- `site/src/data/catalog.json`: consumed by Astro at build time.
- `site/public/index.json`: the same data without `bodyHtml`, published at
  `<base>/index.json` as a stable, machine-readable catalog (versioned with a top-level
  `"schemaVersion": 1`).

### 4.3 Markdown rendering

Skill, agent, command and README bodies are contributor content. Render with
`remark` → `rehype` → `rehype-sanitize` (default GitHub schema). No raw HTML, no scripts,
no inline event handlers. Relative links and images are rewritten to the GitHub blob URL
of the file at `commit`.

### 4.4 Catalog-only metadata

Search quality improves with keywords that aren't in the description. Claude Code ignores
`plugin.json` `metadata`, so the catalog reads its own fields from there:

```json
{
  "metadata": {
    "catalog": {
      "minClaudeCodeVersion": "2.1.300",
      "artifacts": {
        "skill/hello": { "keywords": ["greeting", "smoke test", "install check"] }
      }
    }
  }
}
```

All fields are optional. Unknown keys under `metadata.catalog` are a build warning.

### 4.5 Content visibility

`site/catalog.config.json`:

```json
{ "publishContent": "metadata" }
```

- `full`: artifact bodies and plugin READMEs are rendered and searchable.
- `metadata`: only names, descriptions, keywords, tags and trust data are published;
  `bodyHtml`, `bodyText` and `readmeHtml` are omitted.

See open question Q1.

## 5. Search

### 5.1 Index

Built at `astro build` time from `catalog.json` and shipped as serialized MiniSearch JSON
(`<base>/search-index.json`), loaded on first focus of the search box (and immediately on
the home page).

Documents: every artifact **and** every plugin (type `plugin`).

| Field | Boost |
| :- | :- |
| `name`, `displayName` | 4 |
| `keywords`, `tags` | 3 |
| `description` | 2 |
| `plugin`, `category` | 1.5 |
| `bodyText` | 0.5 |

Options: `prefix: true`, `fuzzy: 0.2`, `combineWith: "OR"`. Stored fields: everything a
card needs, so results render without loading `catalog.json`.

### 5.2 Query processing

The user writes natural language. Before searching:

1. Lowercase, strip punctuation.
2. **Type hints**: if the query contains a type word (`skill(s)`, `agent(s)`,
   `command(s)`, `hook(s)`, `mcp`, `server(s)`, `plugin(s)`), remove the word and
   preselect that type filter as a removable chip. "skill for reviewing PRs" → type =
   skill, terms = "reviewing prs".
3. **Stop words**: remove a fixed list of request phrasing: `i, me, my, we, need, want,
   looking, find, show, get, give, something, anything, that, which, can, could, would,
   please, help, a, an, the, for, to, with, of, in, on, and, or, is, are, do, does, how`.
4. **Synonyms**: expand terms from `site/src/search/synonyms.json`
   (e.g. `pr → pull request`, `review → code review`, `test → testing, tests`,
   `docs → documentation`). The file is maintained by hand.
5. If nothing is left after steps 2–3, show all artifacts of the hinted type (or
   everything), sorted by name.

Search runs on every keystroke, debounced 100 ms. Results above 20 are paginated with
"Show more".

### 5.3 Filters and URL state

Filters: type (multi-select), plugin, category. All state is in the URL —
`?q=review+prs&type=skill,agent&plugin=code-tools` — so a search can be shared and the
back button works.

### 5.4 Cards

Each card shows:

- type badge, artifact name, plugin name (link)
- description (clamped to 3 lines)
- up to 4 tags
- invocation string with a copy button (skills, commands)
- trust level icon of the parent plugin (§7.2)

The whole card links to the artifact page. Matched terms in name and description are
highlighted.

### 5.5 Empty result

"Nothing matches *<query>*." plus two actions:

- "Clear filters" (when filters are active)
- "Request a skill": opens
  `https://github.com/<repo>/issues/new?template=skill-request.yml&title=Skill+request:+<query>&query=<query>`

The repository gets `.github/ISSUE_TEMPLATE/skill-request.yml` with fields `query`
(prefilled), `use-case` and `examples`, and label `skill-request`.

## 6. Pages

| Route | Content |
| :- | :- |
| `/` | Search box (autofocus), filters, results. With an empty query: plugin list and "recently updated" (latest CHANGELOG entries) |
| `/plugins/<plugin>/` | Header (name, version, author, license, category), install block, description and README, artifacts grouped by type, dependencies, trust panel, latest changelog entry |
| `/plugins/<plugin>/<type>/<name>/` | Type badge, name, description, invocation, install block, rendered body, "View source on GitHub", sibling artifacts |
| `/setup/` | Settings generator (§8) |
| `/getting-started/` | §6.2 |
| `/index.json` | Machine-readable catalog (§4.2) |
| `404` | Search box and link home |

### 6.1 Install block

Shown on plugin and artifact pages, each line with a copy button:

```
/plugin marketplace add PalkoNazar/devdigest-ai-marketplace
/plugin install <plugin>@devdigest-ai
```

plus the CLI form (`claude plugin …`) in a toggle, and the invocation for the artifact.
If the plugin has `dependencies`, list them under "Also installs".

### 6.2 Getting started

Static content, written in `site/src/content/getting-started.md`:

1. Add the marketplace (session and shell forms).
2. Private repository access: SSH key in `ssh-agent`, or `gh auth login` +
   `gh auth setup-git`; `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` without an SSH key.
3. Install and invoke a plugin.
4. Turn on auto-update (`/plugin` → Marketplaces → Enable auto-update) and manual update.
5. Share with a team: link to `/setup/`.
6. Troubleshooting: `Plugin not found in marketplace`, clone auth failures,
   `/reload-plugins`, `claude plugin list` errors.

## 7. Trust panel

A factual summary of what a plugin can execute or connect to, derived statically from its
files. It is not a security review, and the panel says so.

### 7.1 Sections

| Section | Shown | Source |
| :- | :- | :- |
| Hooks | Event, matcher, the exact command or args, exec vs shell form | `hooks/hooks.json`, `hooks` key |
| MCP servers | Name; `stdio` → command and args; `http`/`sse`/`ws` → URL and host; env var names (never values) | `.mcp.json`, `mcpServers` key |
| Background monitors | Name, command, when it starts | monitors |
| Executables on PATH | Files in `bin/` | `bin/` |
| Configuration it asks for | `userConfig` keys with title, required, and whether it's stored as a secret | `userConfig` |
| Tool access | `allowed-tools` of commands, `tools` of agents | frontmatter |
| Network hosts | Deduplicated hosts from MCP URLs | derived |
| Requirements | `minClaudeCodeVersion`, dependencies | `metadata.catalog`, `dependencies` |

Empty sections are shown as "None" rather than hidden, so absence is explicit.

### 7.2 Trust level

One summary level per plugin, derived by fixed rules, shown on cards and the plugin page:

| Level | Rule |
| :- | :- |
| **Content only** | No hooks, MCP servers, monitors or `bin/` |
| **Runs local commands** | Has hooks, `stdio` MCP servers, monitors or `bin/`, and no remote MCP servers |
| **Connects to network** | Has at least one `http`, `sse` or `ws` MCP server |

`sensitive` `userConfig` adds a "Asks for secrets" tag alongside the level.

## 8. Settings generator (`/setup/`)

### 8.1 UI

- Plugin list with checkboxes, search-filterable, showing trust level and description.
- Selecting a plugin auto-selects its dependencies (shown as "required by X", not
  deselectable while X is selected).
- Target: **Project settings** (`.claude/settings.json`, default) or **Managed settings**
  (for admins).
- Output panel with the JSON, "Copy" and "Download" buttons, and the equivalent CLI
  commands.
- Selection is kept in the URL (`/setup/?p=hello-world,code-tools&target=project`).

### 8.2 Output

Project target:

```json
{
  "extraKnownMarketplaces": {
    "devdigest-ai": {
      "source": { "source": "github", "repo": "PalkoNazar/devdigest-ai-marketplace" }
    }
  },
  "enabledPlugins": {
    "hello-world@devdigest-ai": true
  }
}
```

Managed target: the same, plus `"autoUpdate": true` on the marketplace entry (checkbox,
on by default), and a note on where managed settings live.

The page explains that teammates are prompted to install when they trust the project
folder, and that they still need read access to the repository (link to Getting started).
Merging into an existing settings file is the user's job; the page says to merge the two
keys rather than overwrite the file.

## 9. Build and deploy

`.github/workflows/pages.yml`:

- **Triggers**: `push` to `main`, `pull_request`, `workflow_dispatch`.
- **Job `build`**: checkout (full history for `generatedAt`/commit), Node 22, install
  Claude Code, `claude plugin validate . --strict`, `npm ci` and `npm run build` in
  `site/`, upload `site/dist` with `actions/upload-pages-artifact`.
- **Job `deploy`**: only on `main`; `needs: build`; `actions/deploy-pages`; permissions
  `pages: write`, `id-token: write`; concurrency group `pages`.

Repository setting: Pages source = GitHub Actions.

### 9.1 Project layout

```
site/
├── astro.config.mjs
├── catalog.config.json
├── package.json
├── scripts/build-catalog.ts
├── src/
│   ├── data/catalog.json          (generated, git-ignored)
│   ├── search/{query.ts,synonyms.json,stopwords.ts}
│   ├── components/…
│   ├── content/getting-started.md
│   └── pages/…
├── test/
│   ├── fixtures/                  (sample marketplaces)
│   └── *.test.ts
└── public/
```

`npm run build` = `build-catalog` then `astro build`. `npm run dev` runs both with watch
on the repository's `plugins/` and `.claude-plugin/`.

## 10. Non-functional requirements

- **Performance**: home page JS ≤ 50 KB gzipped excluding the search index; search index
  ≤ 300 KB gzipped at 500 artifacts; results update within 50 ms of the debounce on a
  mid-range laptop.
- **Accessibility**: WCAG 2.2 AA; full keyboard use (`/` focuses search, arrow keys move
  through results, Enter opens); visible focus; filter chips and copy buttons have
  accessible names; copy success is announced via `aria-live`.
- **Responsive**: usable from 360 px wide; no horizontal scroll.
- **Themes**: light and dark, following `prefers-color-scheme`, with a manual toggle.
- **No JavaScript**: plugin and artifact pages, Getting started and the full plugin list
  render without JS; search and setup show a notice.
- **Determinism**: the same commit produces the same `catalog.json` apart from
  `generatedAt`.

## 11. Testing

- **Unit (Vitest)**:
  - extractor on fixture marketplaces: default layout, manifest path overrides
    (replace/add/merge rules), inline hooks and MCP servers, external sources, malformed
    frontmatter (must fail the build)
  - trust level rules
  - query processing: type hints, stop words, synonyms, empty remainder
  - settings generator output and dependency auto-selection
- **Sanitization**: fixture with `<script>`, `onerror=` and `javascript:` links renders
  inert.
- **Smoke (Playwright, CI)**: search for a known skill returns its card; filters update
  the URL; empty search shows the request link; setup page JSON matches the selection;
  each generated route returns 200.

## 12. Acceptance criteria

1. Pushing a new skill to `main` makes it searchable on the live site without manual
   steps.
2. Searching "I need a skill to greet users" returns `hello-world/skill/hello` first, with
   the type chip "skill" applied.
3. Every plugin page shows a trust panel whose sections match the plugin's files.
4. The setup page output, pasted into a project's `.claude/settings.json`, makes Claude
   Code prompt to install the selected plugins in that project.
5. A broken `marketplace.json` or unparseable frontmatter fails the PR check.
6. Lighthouse: Performance ≥ 95, Accessibility = 100 on the home page.

## 13. Milestones

1. **Extractor + catalog.json** with tests, wired into CI (no site yet).
2. **Static pages**: plugin, artifact, Getting started; deploy to Pages.
3. **Search**: index, query processing, cards, filters, URL state, empty result + issue
   template.
4. **Trust panel**.
5. **Setup generator**.
6. Accessibility and performance pass, Playwright smoke tests.

## 14. Open questions

- **Q1. Visibility.** The repository is private, but its Pages site is public (except on
  GitHub Enterprise Cloud with private Pages). Choose: make the repository public, publish
  with `publishContent: "full"`, or publish with `"metadata"`. Until decided, the default
  is `"metadata"`.
- **Q2. Skill requests in a private repository.** Only people with access can open issues.
  If the audience is wider than collaborators, the "Request a skill" link needs another
  target (Discussions in a public repo, a form, an email link).
- **Q3. Custom domain** instead of `palkonazar.github.io/devdigest-ai-marketplace`.
- **Q4. Category taxonomy.** Free-form today; a fixed list would make the category filter
  more useful.
