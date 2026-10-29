# Migrating legacy code (the known-violations baseline)

Most codebases adopt the rings after code already exists. Freeze what is there, make new
code comply, and shrink the debt module by module.

## Start

1. Add the dependency-cruiser config (`enforcement.md`) in its own change.
2. Generate the baseline (known-violations file) from the current state and commit it.
   The check is now green and fails only on **new** violations.
3. Record the count per rule so progress is visible. For example:

```bash
node -e "const v=require('./.dependency-cruiser-known-violations.json');const c={};for(const x of v)c[x.rule.name]=(c[x.rule.name]||0)+1;console.log(v.length,c)"
```

Frozen violations are not endorsed. Don't copy their shapes into new code. When a task
touches a file with a known violation anyway, fix it in a separate commit if it is small,
then regenerate the baseline so it shrinks.

## Common legacy shapes and their fix

| Shape | Violation | Fix |
|---|---|---|
| Routes-only module: queries and logic inside handlers | ORM + `db/schema` in `routes.ts` | extract `repository.ts` (+ `ports.ts`) and a `service.ts`; routes keep only schema → context → service call |
| A helper file that reads the container and queries the DB | container + ORM in the core | split: queries → the module's repository; logic takes `{ repo }` |
| Service constructor takes the whole container | service locator | define `…Deps` in `ports.ts`; build it in `routes.ts` or a container getter |
| Long-running executor/pipeline pulling everything from the container, importing schema/row types and a concrete logger | container, `db/**`, concrete infra in the core | inject `{ repo, otherRepo, provider, events }`; take domain types from the repository |
| Service uses a row type from another module | ORM row crosses rings and modules | the owning repository (exposed as a port) returns the contract |
| `helpers.ts` imports `db/schema` for a row type | ORM in the core | move the row → DTO mapper into the repository |
| Cycle `helpers ↔ repository` (helpers take rows, repository uses a helper) | cycle | move mappers into the repository; helpers keep pure domain logic |
| Container getter builds a service by passing `this` | cycle `service → container → service` | pass explicit deps; the getter builds them |
| Module imports an adapter directly | `modules-use-ports-not-adapters` | add a port for it and inject the adapter; if the "adapter" is pure (a parser), move it inward to shared or a pure package |
| Adapter imports a module's constants | outer ring → module | move the constant into the adapter (or shared); the module imports it via the port or shared |
| Module imports another module's constants/helpers | cross-module internals | expose what's needed through a port, or move the constant to shared |

## Order that pays off first

1. Routes-only modules — biggest, simplest wins; unlocks unit tests for them.
2. A small, clean module as the template for the rest.
3. The hottest path (the main pipeline/executor) — ports make it mock-testable end to end.
4. The largest module last; break adapter → module edges (constant moves) first.

Each step: one module per branch/commit, run the project's typecheck, tests and
architecture check, then regenerate the baseline.
