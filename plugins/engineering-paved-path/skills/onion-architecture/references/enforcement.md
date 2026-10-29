# Enforcement: dependency-cruiser fitness function

Rules are only real if a machine checks them. If the project has a dependency-cruiser
config (`.dependency-cruiser.{js,cjs,mjs,json}`), it is the source of truth for the ring
table: read it, run the check the project documents (look in `CLAUDE.md`, `package.json`
scripts and CI), and treat a new violation as a failure. If the project has no config,
judge the rules by reading imports, and suggest adding one as a separate change — never
silently in a feature PR.

## Typical commands

Script names vary; find the project's own in `package.json` / CI. Common shapes:

| Command | What it does |
|---|---|
| `npx depcruise src --config .dependency-cruiser.cjs --ignore-known` | fail on any violation **not** in the baseline |
| `npx depcruise-baseline src --config .dependency-cruiser.cjs` | rewrite `.dependency-cruiser-known-violations.json` from the current state |
| `npx depcruise src --config .dependency-cruiser.cjs --output-type err` | show all violations, known ones included |

Projects usually wrap the first two in `package.json` scripts (e.g. `deps:check` / `deps:baseline`, or
`lint:deps`). Use the wrapper when it exists.

## Rules that encode the rings

| Rule | Forbids |
|---|---|
| `no-circular` | any import cycle |
| `shared-is-innermost` | `shared/` importing anything but `zod` and itself |
| `domain-package-is-pure` | a pure domain package importing app code, the ORM, the HTTP framework, `fs`, `child_process`, or I/O SDKs |
| `orm-only-in-repositories` | the ORM, the DB driver, `src/db/**` from any module file except `repository.ts` / `repository/**` |
| `sdk-only-in-adapters` | vendor SDKs from `modules/**` |
| `modules-use-ports-not-adapters` | `modules/**` importing `src/adapters/**` |
| `framework-only-in-routes` | HTTP framework packages from module files other than `routes.ts` (and the module registry / request-context helper) |
| `no-container-in-core` | module core (everything but routes/repository) importing the container |
| `no-infra-in-core` | module core importing concrete platform infra (job runner, SSE bus, logger implementation) |
| `no-cross-module-internals` | `modules/a/**` importing `modules/b/**` (except `modules/_shared`) |
| `outer-ring-not-into-modules` | `adapters/`, `db/`, `platform/` (except the container) importing `modules/**` |

## Generic config example

Adapt folder names and package lists to the project; keep the rule names stable so
review comments and baselines stay readable.

```js
// .dependency-cruiser.cjs
/** Build a package matcher that hits both resolved paths and bare names. */
const pkg = (names) => `(^|node_modules/)(${names.join('|')})(/|$)`;

const ORM = ['drizzle-orm', 'postgres', 'pg', 'mysql2', 'better-sqlite3'];
const FRAMEWORK = ['fastify', '@fastify/[^/]+', 'fastify-plugin', 'fastify-type-provider-zod'];
const SDKS = ['openai', '@anthropic-ai/sdk', 'stripe', '@aws-sdk/[^/]+', 'octokit', '@octokit/[^/]+'];

// module core = every module file except the edge (routes) and persistence (repository)
const MODULE_EDGE = ['^src/modules/[^/]+/routes\\.ts$', '^src/modules/[^/]+/repository(\\.ts$|/)'];

module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'shared-is-innermost', severity: 'error',
      from: { path: '^src/shared/' },
      to: { pathNot: ['^src/shared/', pkg(['zod'])] },
    },
    {
      name: 'orm-only-in-repositories', severity: 'error',
      from: { path: '^src/modules/', pathNot: '^src/modules/[^/]+/repository(\\.ts$|/)' },
      to: { path: [pkg(ORM), '^src/db/'] },
    },
    {
      name: 'sdk-only-in-adapters', severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: pkg(SDKS) },
    },
    {
      name: 'modules-use-ports-not-adapters', severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'framework-only-in-routes', severity: 'error',
      from: { path: '^src/modules/', pathNot: ['^src/modules/[^/]+/routes\\.ts$', '^src/modules/index\\.ts$'] },
      to: { path: pkg(FRAMEWORK) },
    },
    {
      name: 'no-container-in-core', severity: 'error',
      from: { path: '^src/modules/', pathNot: MODULE_EDGE },
      to: { path: '^src/platform/container\\.ts$' },
    },
    {
      name: 'no-cross-module-internals', severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/_shared/'] },
    },
    {
      name: 'outer-ring-not-into-modules', severity: 'error',
      from: { path: '^src/(adapters|db|platform)/', pathNot: '^src/platform/container\\.ts$' },
      to: { path: '^src/modules/' },
    },
  ],
  options: {
    tsPreCompilationDeps: true,        // `import type` counts
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
  },
};
```

Notes:
- `tsPreCompilationDeps: true` → `import type` counts. A type-only import still couples
  the rings, and it is exactly how service-locator leaks (`type Container`) hide.
- Pure computation libraries (graph, date, in-memory queue) are intentionally allowed in
  the core; only list I/O packages in `SDKS`.
- Build package rules from lists (`pkg([...])`) and add new SDKs to the list; don't
  hand-write `node_modules/x/` patterns. The bare-name alternative also catches imports
  that don't resolve (a package not installed in that workspace).
- Regexes must pass dependency-cruiser's safe-regex check: `(.+/)?` is rejected; use `.*`.
- Don't add an `exclude` like `(^|/)dist/` — package managers resolve packages to paths
  such as `node_modules/.pnpm/<pkg>/…/dist/index.js`, so it silently hides SDK imports.
- The baseline is passed on the command line (`--ignore-known`, which defaults to
  `.dependency-cruiser-known-violations.json`), not in the config.

## Baseline workflow ("only shrinks")

- The known-violations file freezes legacy debt so the check can be green today while
  **new** code must comply.
- Fixed a violation → regenerate the baseline and commit the smaller file.
- Never regenerate the baseline to make a *new* violation pass. If a rule is wrong, change
  the rule in the config with a comment explaining why, in its own commit.
- Review tip: a PR diff that *adds* entries to the known-violations file is a red flag.

## Sources
- [dependency-cruiser: rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) ·
  [options reference (known violations, tsPreCompilationDeps)](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md)
- [Ken Miyashita: Validate dependencies according to Clean Architecture](https://betterprogramming.pub/validate-dependencies-according-to-clean-architecture-743077ea084c)
- [Xebia: Taking frontend architecture serious with dependency-cruiser](https://xebia.com/blog/taking-frontend-architecture-serious-with-dependency-cruiser/)
- [Atomic Object: Restrict imports with dependency-cruiser](https://spin.atomicobject.com/dependency-cruiser-imports/)
- [DEV: Avoid cross-module dependencies with dependency-cruiser](https://dev.to/jacobandrewsky/avoid-cross-module-dependencies-with-dependency-cruiser-3b0b)
- [Remo Jansen: Enforce Clean Architecture with fresh-onion](https://dev.to/remojansen/enforce-clean-architecture-in-your-typescript-projects-with-fresh-onion-45pi)
