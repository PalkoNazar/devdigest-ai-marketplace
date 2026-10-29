# Ports, adapters and the composition root

## Port → adapter → mock → composition root

Every outside system (LLM, payment provider, email, object storage, git, search,
embeddings, secrets store, auth provider) follows the same four steps — this is what keeps
unit tests key-free and offline:

1. **Port** — an interface in `shared/ports.ts` (external system used by several modules)
   or `modules/<m>/ports.ts` (module-local seam). Written in domain terms:
   `getInvoice(id)`, not `stripe.invoices.retrieve`.
2. **Adapter** — `adapters/<system>/<impl>.ts` implements it. The only place its SDK is
   imported. It maps SDK types to shared types and turns SDK failures into domain errors
   (`ExternalServiceError`, `ConfigError`).
3. **Mock** — a deterministic fake next to the adapters (e.g. `adapters/mocks.ts`).
4. **Wiring** — the composition root (e.g. `platform/container.ts`): a lazy getter plus an
   override hook for tests. Key-backed adapters resolve their secret in the getter and
   throw `ConfigError` when it's missing; invalidate cached clients when a key changes.

Adapters never import `modules/**` or the container. If an adapter needs a constant a
module also uses (a list of supported file types, a size limit), the constant belongs to
the adapter or to shared.

## Composition root, not service locator

The container builds everything, but it must only be *read* at the edges: the container
file itself, `app.ts` / `server.ts`, and each module's `routes.ts` (or worker entry).

```ts
// ❌ service locator: hidden, unbounded dependencies; untestable without a container
class CheckoutService {
  constructor(private container: Container) {}
  async run() { const pay = await this.container.payments(); /* … */ }
}

// ✅ explicit, narrow dependencies
interface CheckoutDeps {
  orders: OrdersRepo;
  customers: CustomersRepo;
  payments: () => Promise<PaymentGateway>;   // lazy factory: missing key fails only when used
  jobs: JobQueue;
  events: ProgressEvents;
}
class CheckoutService { constructor(private readonly deps: CheckoutDeps) {} }
```

Signs of a leak: `import type { Container }` in a service; a service calling
`new SomethingRepository(...)`; a cycle `service → container → service` (a container
getter that builds a service by passing `this`).

Shared ports (used by 2+ modules — e.g. `usersRepo`, `auditLog`) are getters on the
container. Module-local repositories are built in that module's `routes.ts`.

If the project uses a DI library (tsyringe, awilix, InversifyJS), the same rule applies:
resolve at the edge, inject narrow interfaces, and don't let the core import the library's
container or decorators beyond what the project already accepts.

## Jobs (queue runner)

The job runner (in-memory queue, BullMQ, pg-boss, a `jobs` table…) is infrastructure. The
core sees a port:

```ts
// ports.ts
export interface JobQueue {
  enqueue(tenantId: string, kind: string, payload: unknown): Promise<{ id: string }>;
}
```

- The service calls `deps.jobs.enqueue(tenantId, IMPORT_JOB, { sourceId })`.
- `routes.ts` (or the worker entry) registers the handler:
  `c.jobs.register(IMPORT_JOB, (p) => service.import(ImportPayload.parse(p)))`.
- Job kinds and payload schemas live in the module's `constants.ts` / `types.ts`.

## Live events (SSE / websockets) and run logs

An event bus or logger is a concrete platform singleton. Give the core a narrow port:

```ts
export interface ProgressEvents {
  publish(runId: string, kind: ProgressKind, msg: string, data?: unknown): void;
  isCancelled(runId: string): boolean;
}
```

Inject the concrete bus (it can satisfy the port structurally) or a logger built at the
edge. The SSE/websocket route subscribes to the bus directly — it is the edge.

## Pure domain packages and injected ports

A pure domain package (a rules engine, a pricing calculator, a prompt builder) takes
whatever I/O it needs as injected ports (e.g. an `LLMProvider`). It never reads keys,
env, the DB or files. If such a package ships its own adapter for reuse elsewhere, treat
that as a documented exception: the adapter still only implements the port.

## Sources
- [Alistair Cockburn: Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture)
- [Mark Seemann: Service Locator is an Anti-Pattern](https://blog.ploeh.dk/2010/02/03/ServiceLocatorisanAnti-Pattern/) ·
  [Service Locator violates encapsulation](https://blog.ploeh.dk/2015/10/26/service-locator-violates-encapsulation/)
- Counterpoint: [Jimmy Bogard: Service Locator is not an Anti-Pattern](https://www.jimmybogard.com/service-locator-is-not-an-anti-pattern/)
- [Herberto Graça: Explicit Architecture](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/)
- [AWS Prescriptive Guidance: Hexagonal architecture](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html)
