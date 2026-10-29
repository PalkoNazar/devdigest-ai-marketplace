---
name: onion-architecture
description: "Onion (ports & adapters / hexagonal / clean) architecture for a TypeScript Node backend (typically Fastify + Drizzle + Zod): which layer a piece of backend code belongs to, which imports are allowed between rings, how a feature module splits into routes → service → ports → repository/adapters, how services get dependencies (constructor injection of narrow ports, never a whole DI container or service locator), where framework, ORM, Zod parsing, SDK calls, background jobs and SSE may appear, how to test each ring with fakes, how to migrate legacy code, and how to enforce the rules with dependency-cruiser. Use whenever you add or move a backend file, create a module/route/service/repository/adapter/job, touch the composition root or DI container, put a DB query or third-party SDK call somewhere, or review a backend PR for structure — even if the user only says 'add an endpoint', 'add a column to this response', 'call this API from here', 'where should this go' or 'is this layered correctly'."
metadata:
  version: 1.0.0
  updated: 2026-10-29
---

# Onion architecture — TypeScript Node backend

Backend code is arranged in rings. **Source dependencies point only inward**: inner code
never names anything from an outer ring — not a class, not a type, not a data format
(Palermo's Onion, Martin's Dependency Rule, Cockburn's Ports & Adapters). Infrastructure
(the HTTP framework, the ORM, SDKs, job queues, SSE/websockets) is pushed to the edge and
plugged in through interfaces, so the core can be tested with plain fakes and swapped
without edits.

This skill covers *where backend code lives and what it may import*. For how to write the
inside of a route see `engineering-paved-path:fastify-best-practices`; for auth, input
handling and secrets see `engineering-paved-path:security`. Where a framework guide hangs
services on Fastify decorators over `fastify.db`, or queries the database without a
repository boundary, **this skill wins**.

## Adapt to the project first

The paths below (`src/modules/<module>/…`, `src/adapters/…`, `src/platform/…`,
`src/shared/…`) are placeholders for the usual roles, not a required layout. Before
placing code:

1. Read the project's own conventions: `CLAUDE.md` / `AGENTS.md` (root and nested),
   `README`, any architecture doc (`docs/architecture*`, ADRs), and the dependency-cruiser
   config if there is one (`.dependency-cruiser.{js,cjs,mjs,json}`).
2. Map each ring below to the project's real folders (e.g. `features/` instead of
   `modules/`, `infra/` instead of `adapters/`, a `packages/contracts` workspace instead
   of `src/shared/`). Use the project's names in code and in review comments.
3. Where the project documents a stricter or different rule, follow the project. Where it
   is silent, apply this skill. If the project has no layering at all, propose this
   layout for new code and don't rewrite old code in the same change.

## The rings

```
 ┌─ OUTER: infrastructure & delivery ────────────────────────────────────────────┐
 │  modules/<m>/routes.ts   HTTP plugin = the module's edge + its wiring          │
 │  modules/<m>/repository.ts, repository/*.repo.ts   ORM code (implements ports) │
 │  adapters/**   SDKs (HTTP APIs, LLMs, git, storage, email…) implement ports    │
 │  db/**  platform/**  app.ts / server.ts   container = COMPOSITION ROOT         │
 │ ┌─ APPLICATION: use cases ──────────────────────────────────────────────────┐ │
 │ │  modules/<m>/service.ts (+ larger pipelines/workflows)                    │ │
 │ │  orchestrates ports, owns the transaction boundary, throws domain errors  │ │
 │ │ ┌─ DOMAIN SERVICES & PORTS ─────────────────────────────────────────────┐ │ │
 │ │ │  modules/<m>/ports.ts   interfaces the service needs (repo, queue…)   │ │ │
 │ │ │  modules/<m>/helpers.ts constants.ts types.ts   pure, no I/O          │ │ │
 │ │ │ ┌─ DOMAIN MODEL ────────────────────────────────────────────────────┐ │ │ │
 │ │ │ │  shared/  Zod contracts (domain types) + ports for external systems│ │ │ │
 │ │ │ │  optional pure domain packages (calculation/rules engines)        │ │ │ │
 │ │ │ └───────────────────────────────────────────────────────────────────┘ │ │ │
 │ │ └───────────────────────────────────────────────────────────────────────┘ │ │
 │ └───────────────────────────────────────────────────────────────────────────┘ │
 └───────────────────────────────────────────────────────────────────────────────┘
```

| Ring | May import | Must NOT import |
|---|---|---|
| `shared/` (contracts) | `zod`, itself | anything else in `src/`, any framework or SDK |
| pure domain package (if any) | `shared/`, `zod`, pure libs | `db/`, `modules/`, `platform/`, `adapters/`, the HTTP framework, the ORM, `fs`, I/O SDKs |
| module core (`service`, `helpers`, `ports`, `types`, `constants`, `pipeline/`…) | shared, pure domain packages, own module files, `platform/errors`, small pure platform utils (retry/backoff), pure libs | the container, `platform/{jobs,sse,logger…}` concrete infra, `db/**`, the ORM, the HTTP framework, `adapters/**`, SDKs, other modules |
| `repository*` | the ORM, `db/schema`, `db/client`, shared, own `ports`/`types` | the HTTP framework, the container, other modules |
| `routes.ts` | the HTTP framework, the container, own service/repository, `modules/_shared/*`, shared | the ORM, `db/**`, SDKs, other modules |
| `adapters/**` | its SDK, shared ports, `platform/errors` | `modules/**`, the container |
| container, `app.ts` | everything — this is where rings are wired | — |

If the project has a dependency-cruiser config, these rows should be rules in it and the
check should run in CI. Legacy violations are frozen in a known-violations baseline; a new
one fails the check. Details and a generic config → `${CLAUDE_SKILL_DIR}/references/enforcement.md`.

## Where does X go? (decision table)

| You have… | Put it in |
|---|---|
| A new HTTP endpoint | `modules/<m>/routes.ts`: schema → request context (user/tenant) → one service call → return. Nothing else. |
| Business rule / orchestration (if/else on domain state, calling 2+ ports) | `modules/<m>/service.ts` method (a use case) |
| A calculation / mapping with no I/O | `modules/<m>/helpers.ts` (unit-tested without mocks) |
| A SQL query | a method on `modules/<m>/repository.ts` (or `repository/<entity>.repo.ts`), declared in `ports.ts` |
| Row → contract mapping (`toOrderDto`) | inside the repository (or `repository/mappers.ts`); rows never leave it |
| A shape crossing HTTP or reaching a client | Zod contract in `shared/` (and in the client's copy/package if the contract is shared with a frontend) |
| A type used only by the module's core | `modules/<m>/types.ts` |
| An interface the service depends on | `modules/<m>/ports.ts` (module-local seam) or `shared/ports.ts` (external system used by several modules) |
| A call to a third-party API / LLM / git / filesystem / any new SDK | an adapter in `adapters/<system>/` implementing a port + a mock/fake + a getter in the composition root |
| Data owned by another module | a port exposed by the composition root (e.g. `container.usersRepo`), injected — never `import '../other-module/…'` |
| Long-running work (import, sync, export) | the service calls a `JobQueue` port; `routes.ts` (or a worker entry) registers the handler |
| Live progress events | the service emits through a small `Events` port; the concrete bus/SSE is injected at the edge |
| A new domain error | a subclass in `platform/errors.ts`; the global error handler maps it to HTTP |
| Env / config value | `platform/config.ts` (parsed once at boot); secrets only through a secrets port/getter |

## Module shape

```
src/modules/<module>/
├── routes.ts        edge: framework plugin; builds the service with its deps; registers job handlers
├── service.ts       use cases: class XService { constructor(private deps: XDeps) }
├── ports.ts         export interface XRepo {…}; export interface XDeps { repo: XRepo; … }
├── repository.ts    class XRepository implements XRepo — ORM only here
├── helpers.ts       pure functions (optional)
├── constants.ts     (optional)
└── types.ts         module-internal domain types (optional)
```

Create only files that have content. Big modules may split `repository/` and `pipeline/`
folders; the same ring rules apply to every file inside.

### The wiring, end to end

```ts
// ports.ts — what the use case needs, in domain terms. No ORM, no framework.
import type { Project, Notifier } from '../../shared/index.js';
export interface ProjectsRepo {
  list(tenantId: string): Promise<Project[]>;
  findById(tenantId: string, id: string): Promise<Project | null>;
}
export interface ProjectsDeps { repo: ProjectsRepo; notifier: () => Promise<Notifier> }

// service.ts — depends on ports only; trivially testable with fakes.
export class ProjectsService {
  constructor(private readonly deps: ProjectsDeps) {}
  async get(tenantId: string, id: string): Promise<Project> {
    const project = await this.deps.repo.findById(tenantId, id);
    if (!project) throw new NotFoundError(`Project ${id} not found`);
    return project;
  }
}

// repository.ts — implements the port; rows are mapped before they leave.
export class ProjectsRepository implements ProjectsRepo {
  constructor(private readonly db: DbExecutor) {}
  async findById(tenantId: string, id: string) {
    const [row] = await this.db.select().from(t.projects)
      .where(and(eq(t.projects.tenantId, tenantId), eq(t.projects.id, id)));
    return row ? toProjectDto(row) : null;
  }
  // …
}

// routes.ts — the edge: the ONLY module file that reads the container.
export default async function projectsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const c = app.container;
  const service = new ProjectsService({
    repo: new ProjectsRepository(c.db),
    notifier: () => c.notifier(),
  });
  app.get('/projects/:id', { schema: { params: IdParams } }, async (req) => {
    const { tenantId } = await getRequestContext(c, req);
    return service.get(tenantId, req.params.id);
  });
}
```

## Hard rules

1. **Dependency rule.** An inner file never imports from an outer ring, including
   `import type`. A type-only import of the container, an ORM row type or `FastifyRequest`
   still couples the core to that ring (and dependency-cruiser with
   `tsPreCompilationDeps` counts it).
2. **No service locator in the core.** A service receives narrow, named dependencies
   (`{ repo, notifier, jobs }`) via its constructor — never the whole container. Composition
   happens in the composition root (shared ports) and the module's `routes.ts` (module
   wiring). Never `new XRepository(...)` or `new SomeAdapter(...)` inside a service.
3. **Thin routes.** A handler parses (Zod schema on the route), resolves the request
   context (user, tenant), calls ONE service method, shapes the reply (status code). No
   queries, no SDK calls, no business `if`s. Don't `Schema.parse(req.body)` by hand; don't
   `try/catch` to build HTTP errors — throw domain errors from the service.
4. **The ORM stays in repositories.** Repositories return `shared/` contracts or module
   `types.ts` shapes, not `$inferSelect` rows. In a multi-tenant app every query is scoped
   by the tenant key (child tables via their scoped parent). The service owns transaction
   boundaries → see `${CLAUDE_SKILL_DIR}/references/drizzle.md`.
5. **Parse at every boundary, trust inside.** HTTP input (route schema), job payloads
   (`unknown` → Zod parse in the handler), LLM output, external API data (in the adapter),
   config (at boot). Never re-validate inside the core.
6. **Every outside system is a port + adapter + mock.** SDK imports live only in
   `adapters/**`; the port lives in `shared/ports.ts` or the module's `ports.ts`; a
   deterministic fake sits next to the adapters (e.g. `adapters/mocks.ts`); the lazy getter
   (and a test override) lives in the composition root.
7. **Modules don't import each other.** Share through a port on the composition root, or
   move the shared piece inward (`shared/`, `modules/_shared/`). Adapters never import
   modules — constants they need move into the adapter or into shared.
8. **Pure domain packages stay pure.** A calculation or rules engine (pricing, scoring,
   parsing) has no DB, fs, network or env access. Its only side effects come through
   injected ports.

## Checklist (new code or PR review)

- [ ] The project's architecture check passes (dependency-cruiser or whatever the project
      documents); no new violations; the baseline did not grow.
- [ ] New route: schema from `shared/` / `modules/_shared/schemas`, request context
      first, one service call.
- [ ] New service: constructor takes a `…Deps` interface from `ports.ts`; no container.
- [ ] New query: in a repository, tenant-scoped where the app is multi-tenant, returns
      contracts not rows.
- [ ] New external call: port + adapter + fake + composition-root getter; the unit test
      uses the fake.
- [ ] Contract changed: every copy/consumer of the shared contract updated (server and
      client if both hold one).
- [ ] Service unit test uses hand-written fakes of its ports (no DB, no container);
      repository covered by an integration test against a real database.
- [ ] Touched a legacy file with a known violation? Don't add to the debt; if you fix a
      violation, regenerate the baseline so it shrinks
      (`${CLAUDE_SKILL_DIR}/references/migration.md`).

## Pragmatic limits (don't over-engineer)

- Domain model = Zod contracts + plain functions. No entity classes, aggregates, value
  objects or a DI framework unless the project already uses them.
- One interface per real seam. Don't add a port for a pure helper or for a library that
  does no I/O (graph, date, queue-in-memory libraries are fine in the core).
- A trivial read endpoint may be `route → repository` through a one-line service method;
  keep the service anyway so the rule stays uniform.

## References

- `${CLAUDE_SKILL_DIR}/references/fastify.md` — the delivery ring: plugin, schemas, errors, decorators
- `${CLAUDE_SKILL_DIR}/references/drizzle.md` — repositories, mapping, transactions, tenant scoping
- `${CLAUDE_SKILL_DIR}/references/zod-contracts.md` — contracts as the domain model; parse-at-boundary map
- `${CLAUDE_SKILL_DIR}/references/adapters-di.md` — ports, adapters, composition root, jobs, SSE
- `${CLAUDE_SKILL_DIR}/references/testing.md` — which test for which ring
- `${CLAUDE_SKILL_DIR}/references/migration.md` — legacy shapes and how to fix each
- `${CLAUDE_SKILL_DIR}/references/enforcement.md` — dependency-cruiser rules, baseline workflow
- `${CLAUDE_SKILL_DIR}/README.md` — research sources and design decisions
