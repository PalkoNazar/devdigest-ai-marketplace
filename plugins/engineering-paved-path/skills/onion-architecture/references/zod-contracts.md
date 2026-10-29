# Zod contracts: the domain model and the boundary parsers

## Contracts are the innermost ring

A `shared/` folder (or a contracts package in a monorepo) holds Zod schemas whose
`z.infer` types *are* the domain model (`Project`, `Invoice`, `User`…) and the ports for
external systems. Because they sit at the centre:

- `shared/**` imports only `zod` and itself (`shared-is-innermost` rule).
- A shape that crosses HTTP or reaches a client is a shared contract. Change it first,
  then the server, then the client. If the client keeps its own copy of the contracts
  rather than importing a package, update **both copies** and diff them before editing.
- A shape that stays inside one module's core is a plain type in `modules/<m>/types.ts`
  (e.g. `CreateProjectInput`), not a shared contract.
- Don't derive domain types from ORM tables (`typeof t.x.$inferSelect`) — that makes the
  centre depend on the DB. Map rows to contracts in the repository.

## Parse, don't validate — once, at each boundary

Untrusted data becomes a typed value exactly where it enters; the core then trusts it.

| Boundary | Where the parse happens | How |
|---|---|---|
| HTTP request | `routes.ts` | `schema: { params, querystring, body }` via `fastify-type-provider-zod` (or the framework's equivalent) |
| HTTP response (optional) | `routes.ts` | `schema.response` — serialization failures become a generic 500 |
| Job payload (`unknown`) | the handler registered in `routes.ts` / the worker | `Payload.parse(payload)` before calling the service |
| LLM output | the adapter (or a shared structured-output helper) | schema parse with a repair/retry step; don't hand-roll JSON parsing |
| Third-party API data | the adapter | map SDK types to shared types before returning |
| DB rows | repository | trusted (schema-typed) — map, don't re-parse |
| Config / env | `platform/config.ts` | one Zod parse at boot |

Inside the core: no `safeParse` of values that already crossed a boundary, no `as` casts
to paper over an unparsed `unknown`.

## Sources
- [Zod docs](https://zod.dev/)
- [Alexis King: Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
- [Steve Kinney: Zod best practices](https://stevekinney.com/courses/full-stack-typescript/zod-best-practices)
- [hyper: Using Zod to parse function schemas (Ports & Adapters)](https://blog.hyper.io/using-zod-to-parse-function-schemas/)
- [Uncle Bob: data formats of an outer circle must not be used by an inner circle](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
