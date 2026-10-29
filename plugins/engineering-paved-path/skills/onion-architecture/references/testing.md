# Testing by ring

The payoff of the onion is that each ring can be tested without the ones outside it.
Follow the project's test layout and naming (see its `CLAUDE.md` / testing docs); the
table gives the kind of test per ring.

| Ring | Test | Needs | Typical naming |
|---|---|---|---|
| `helpers.ts`, pure pipeline steps, pure domain packages | pure unit test: input → output | nothing | `<module>-helpers.test.ts` / `helpers.test.ts` |
| `service.ts` (use cases) | unit test with **hand-written fakes of its ports** | nothing — no DB, no container, no keys | `<module>-service.test.ts` |
| `repository.ts` | integration test against a real database (testcontainers or a test DB) | Docker / DB | a separate suffix such as `*.it.test.ts` / `*.integration.test.ts` |
| `adapters/**` | contract test of the adapter against its port; SDK stubbed or recorded | nothing | `<adapter>.test.ts` |
| `routes.ts` | build the app with test overrides + `app.inject()` | fakes from the adapters' mocks; DB only in integration tests | `<module>.routes.test.ts`, `<module>.it.test.ts` |

## Service test with fakes (the target shape)

```ts
const repo: ProjectsRepo = {
  list: async () => [],
  findById: async (_tenant, id) => (id === 'p1' ? projectFixture : null),
  transaction: (work) => work(repo),
  // …only what the use case touches
};
const service = new ProjectsService({ repo, notifier: async () => fakeNotifier });

await expect(service.get('t1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
```

If a service test needs a container, a DB or `vi.mock`/`jest.mock` of a module path, the
service has an undeclared dependency — fix the design (add it to `…Deps`), not the test.

## Rules
- Unit tests never hit the network or require API keys; external systems come from the
  adapters' fakes or inline fakes.
- Don't unit-test ORM queries with mocks of `db.select()` — test repositories against a
  real database in integration tests.
- Run the app in test mode (quiet logs, no rate limiting) through the same composition
  root with overrides, not a parallel test-only wiring.

## Sources
- [Alistair Cockburn: Hexagonal architecture — "driven by… automated tests"](https://alistair.cockburn.us/hexagonal-architecture)
- [Khalil Stemmler: Application layer use cases](https://khalilstemmler.com/articles/enterprise-typescript-nodejs/application-layer-use-cases/)
