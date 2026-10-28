# Catalog site

The DevDigest AI catalog: a static site that lists every plugin, skill, agent, command,
hook and MCP server in this repository, with search, a trust panel per plugin and a
settings generator. Spec: [`docs/specs/catalog-site.md`](../docs/specs/catalog-site.md).

It lives in its own directory and only reads the marketplace: nothing here is part of a
plugin, and `claude plugin validate` never looks at it.

## Develop

```bash
cd site
npm install
npm run dev      # http://localhost:4321/devdigest-ai-marketplace/
npm test         # extractor, query parsing, setup generator
npm run build    # → site/dist
```

The build reads `.claude-plugin/marketplace.json` and the plugin directories from the
repository root, so adding or editing a plugin updates the site on the next build. A file
it can't parse fails the build.

To build against another marketplace, set `CATALOG_ROOT`:

```bash
CATALOG_ROOT=$PWD/test/fixtures/market npm run dev
```

## Configure

`catalog.config.json`:

| Key | Meaning |
| :- | :- |
| `publishContent` | `metadata` (default) publishes names, descriptions and trust data only. `full` also publishes skill, agent and command bodies and plugin READMEs |
| `repo` | `owner/name` of the marketplace repository, for install commands and links |
| `branch` | Branch that "View on GitHub" links point at |

Optional per-plugin catalog fields go in `plugin.json` under `metadata.catalog`, which
Claude Code ignores:

```json
{
  "metadata": {
    "catalog": {
      "minClaudeCodeVersion": "2.1.300",
      "artifacts": { "skill/hello": { "keywords": ["greeting", "install check"] } }
    }
  }
}
```

Search synonyms are in `src/search/synonyms.json`.

## Deploy

`.github/workflows/pages.yml` tests and builds the site on every push and pull request.
It deploys to GitHub Pages from `main` once both are true:

1. Pages is enabled for the repository with **Settings → Pages → Source: GitHub Actions**.
   A private repository needs a paid GitHub plan for this, and the site itself is public.
2. The repository variable `PAGES_ENABLED` is `true`
   (**Settings → Secrets and variables → Actions → Variables**).

The site is served at `https://palkonazar.github.io/devdigest-ai-marketplace/`. For a custom
domain at the root, build with `SITE_BASE=/`.
