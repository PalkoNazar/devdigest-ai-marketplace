# Fastify: the delivery ring

Fastify (or any HTTP framework) is a *driving adapter*: it turns HTTP into calls on the
application core and the core's results/errors back into HTTP. Nothing inside the core
knows it exists. For Fastify idioms themselves (hooks, schemas, serialization, logging)
see `engineering-paved-path:fastify-best-practices`; this file only fixes where those
idioms may appear.

## A module = one encapsulated plugin

- `modules/<m>/routes.ts` default-exports `async function (appBase: FastifyInstance)`.
  Register modules in one place (e.g. `modules/index.ts`, imported only by `app.ts`).
  Static registration is easier to trace than autoload; follow whatever the project does.
- Fastify's `register` creates an encapsulated child context (a DAG of plugins). Use that
  for module-local hooks/decorators; don't reach into another module's plugin.
- `app.container` (decorated once in `app.ts`) is the bridge from Fastify to the
  composition root. **Only `routes.ts` reads it.** Build the service at plugin start:

```ts
export default async function importsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const c = app.container;
  const service = new ImportsService({
    repo: new ImportsRepository(c.db),     // module-local repository: wired here
    storage: c.storage,                    // shared port: taken from the container
    jobs: c.jobs,                          // the job runner satisfies the JobQueue port
    source: () => c.sourceApi(),           // lazy: throws ConfigError when no API key
  });
  c.jobs.register(IMPORT_JOB, (payload) => service.run(ImportPayload.parse(payload)));
  // …routes
}
```

- Don't use `fastify.decorate` to hang services on the instance for other modules to pull
  — that is a second service locator. Cross-module sharing goes through a port on the
  composition root.

## Handler shape

```ts
app.post('/imports', { schema: { body: ImportInput } }, async (req, reply) => {
  const { tenantId, userId } = await getRequestContext(app.container, req); // 1. who / which tenant
  const { item, created } = await service.add(tenantId, userId, req.body.url); // 2. ONE use case
  reply.status(created ? 201 : 200);                                          // 3. HTTP shape
  return item;
});
```

- Schemas: `params`/`querystring`/`body` (and `response` where it helps) come from
  `shared/` or `modules/_shared/schemas.ts` (`IdParams`). Validation failures become a
  4xx in the global error handler. Never `Schema.parse(req.body)` by hand.
- Pass plain values into the service (`tenantId`, `req.body.url`), never `req`/`reply`.
- Status codes and headers are the route's job; the domain decides *what happened*
  (e.g. `created: boolean`), the route decides *how to say it in HTTP*.

## Errors

- The core throws domain error subclasses from `platform/errors.ts` (`NotFoundError`,
  `ValidationError`, `ConfigError`, `ExternalServiceError`…). `app.setErrorHandler` in
  `app.ts` turns them into one error envelope (e.g. `{ error: { code, message, details } }`).
- Routes don't `try/catch` just to translate errors. Catch only to *degrade* on a read
  path (an optional integration is not configured → empty/partial result), and prefer
  doing that in the service so it is unit-testable.
- A `statusCode` on the base error class is a pragmatic leak of HTTP into the core (one
  small file, no framework import). Tolerable; don't add more HTTP concepts to the core.

## SSE / streaming

SSE or websocket streaming stays in `routes.ts`. The route subscribes to the event bus and
writes events; the use case only *emits* through a narrow port (see `adapters-di.md`).

## Plugins and cross-cutting concerns

helmet, cors, rate-limit, auth, the error handler and container decoration are
registered in `app.ts` before modules. A new cross-cutting concern (auth hook, request
id) is a plugin there, not code copied into handlers.

## Sources
- [Fastify: Plugins](https://fastify.dev/docs/latest/Reference/Plugins/) ·
  [Plugins Guide](https://fastify.dev/docs/latest/Guides/Plugins-Guide/) ·
  [Encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/) ·
  [Decorators](https://fastify.dev/docs/latest/Reference/Decorators/)
- [Luxlorys/fastify-clean-template](https://github.com/Luxlorys/fastify-clean-template)
- [Snyk: Fastify plugins as building blocks](https://snyk.io/blog/fastify-plugins-for-backend-node-js-api/)
