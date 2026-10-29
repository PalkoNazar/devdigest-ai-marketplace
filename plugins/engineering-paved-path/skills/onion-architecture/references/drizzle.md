# Drizzle (or any ORM): the persistence ring

Drizzle is a typed query builder, not an entity mapper. That makes it easy to "just query
from the handler" — exactly what this ring forbids. Queries live behind a repository
port so the core never sees `drizzle-orm`, `db/schema` or a `$inferSelect` row. The same
rules apply to Prisma, Kysely, TypeORM or raw SQL clients: swap the import names.

## Where the ORM may appear

| File | ORM / `db/**` |
|---|---|
| `modules/<m>/repository.ts`, `modules/<m>/repository/*.ts` | ✅ |
| the composition root, a DB-backed job runner, a DB-backed auth adapter, `db/**` | ✅ (outer ring) |
| `routes.ts`, `service.ts`, `helpers.ts`, `pipeline/**`, any other module file | ❌ |

## Repository = port implementation

```ts
// ports.ts
export interface ProjectsRepo {
  list(tenantId: string): Promise<Project[]>;
  insert(tenantId: string, input: NewProject): Promise<Project>;
}

// repository.ts
export class ProjectsRepository implements ProjectsRepo {
  constructor(private readonly db: DbExecutor) {}
  async list(tenantId: string): Promise<Project[]> {
    const rows = await this.db.select().from(t.projects).where(eq(t.projects.tenantId, tenantId));
    return rows.map(toProjectDto);          // mapping happens HERE
  }
  // …
}
```

- **Return contracts, not rows.** `toXDto(row)` mappers live in the repository file or
  `repository/mappers.ts`. Row types may be imported only by repositories.
- **Scope every query (multi-tenant apps).** Top-level tables filter by the tenant key
  (`tenantId`, `orgId`, `accountId`…); child tables are reached through a parent that was
  scoped. A method that takes an id always takes the tenant key too. This is also an
  access-control rule — see `engineering-paved-path:security`.
- **Granularity.** One repository per module (split into `repository/<entity>.repo.ts`
  when it grows). Name methods by intent (`findOverdueInvoices`, `markImportFailed`), not
  by SQL (`selectWhereStatus`).
- **Cross-module data** → the owning module's repository is exposed as a port on the
  composition root (`container.usersRepo`) and injected; don't import
  `../users/repository.js`.

## Transactions: the use case owns the boundary

The service decides what is atomic; the repository doesn't know whether it runs inside a
transaction. Expose a `transaction` on the port that hands back tx-bound repositories:

```ts
// db/client.ts (add when the first transaction is needed)
export type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbExecutor = Db | DbTx;

// ports.ts
export interface ProjectsRepo {
  transaction<T>(work: (repo: ProjectsRepo) => Promise<T>): Promise<T>;
  update(tenantId: string, id: string, patch: ProjectPatch): Promise<Project>;
  addRevision(projectId: string, snapshot: ProjectSnapshot): Promise<void>;
}

// repository.ts
transaction<T>(work: (repo: ProjectsRepo) => Promise<T>) {
  return this.db.transaction((tx) => work(new ProjectsRepository(tx)));
}

// service.ts — no ORM in sight
await this.deps.repo.transaction(async (repo) => {
  const project = await repo.update(tenantId, id, patch);
  await repo.addRevision(project.id, snapshot(project));
});
```

Keep only DB work inside the callback — never an LLM, HTTP or other slow external call:
it holds a pooled connection for its whole duration and can starve the pool under load.

## Schema & migrations stay outer

`db/schema/<domain>.ts` and the migration commands (`drizzle-kit generate` / `migrate`, or
the project's scripts) are infrastructure. The core never imports a table object to reuse
its column types — define the shape in `shared/` or `types.ts` and map.

## Sources
- [Drizzle ORM docs](https://orm.drizzle.team/) · [Transactions](https://orm.drizzle.team/docs/transactions)
- [Sentry: Atomic repositories in Clean Architecture and TypeScript](https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript)
- [Paul Serban: Drizzle ORM best practices](https://paulserban.eu/blog/post/drizzle-orm-best-practices-principles-patterns-and-real-world-case-studies/)
- [Hassan Javed: Drizzle ORM in production](https://www.hassanjaved.work/blog/drizzle-orm-patterns-production-2026)
- [Microsoft: Designing the infrastructure persistence layer](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design)
- [Khalil Stemmler: DTOs, Mappers & the Repository pattern](https://khalilstemmler.com/articles/typescript-domain-driven-design/repository-dto-mapper/)
- Counterpoint: [You might not need the repository pattern](https://dev.to/jayfreestone/you-might-not-need-the-repository-pattern-46b)
