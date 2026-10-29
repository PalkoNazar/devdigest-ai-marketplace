---
name: frontend-ui-architecture
description: "Where code goes in a Next.js App Router + React client: which folder a new component, hook, constant, helper, type or piece of business logic belongs in, how to split a growing component or fat page, when to promote code to shared, and which imports and index.ts barrels are allowed. Use whenever you add or move a frontend file under src/, create a component or hook, extract constants/helpers from a component, split a large component or page, decide between app/<route>/_components, src/components, a design-system folder or lib/, or review a frontend PR for structure — even if the user only says 'add a panel', 'refactor this component', 'this file is too big' or 'where should this go'."
metadata:
  version: 1.0.0
  updated: 2026-10-29
---

# Frontend UI architecture — Next.js App Router client

Placement rules for a Next.js (App Router) + React client. The goal is that anyone (human
or agent) can predict where a piece of code lives from what it does and who uses it, and
that deleting a feature means deleting a folder. The rules follow one principle:
**colocate by default, promote only when a second consumer appears** (Kent C. Dodds'
colocation + AHA).

This skill covers *where code lives and how it is split*. For how to write the inside of
a component (purity, effects, memoization) see `engineering-paved-path:react-best-practices`;
for RSC/route file conventions see `engineering-paved-path:next-best-practices`; for tests
see `engineering-paved-path:react-testing-library`. Where `react-best-practices` →
"Code Organization" suggests `features/` or `utils/`, this skill wins.

## Adapt to the project first

The paths below are relative to the client's source root (`src/`, or the app package's
`src/` in a monorepo) and name *roles*, not a required layout. Before placing code:

1. Read the project's conventions: `CLAUDE.md` / `AGENTS.md` (root and nested in the
   client), `README`, any architecture or contributing doc, `tsconfig.json` path aliases,
   and lint/boundary configs (eslint-plugin-boundaries, dependency-cruiser) if present.
2. Map each role to the real folders: the design system may be `src/ui/`,
   `src/components/ui/` (shadcn) or a workspace package; contracts may be a shared package
   or a vendored copy; the data layer may use React Query, SWR, server actions or RSC
   fetches; styling may be CSS modules, Tailwind or style objects; i18n may not exist.
3. Where the project documents a different rule, follow the project. Where it is silent,
   apply this skill. Don't reorganize existing folders as part of a feature change.

## The map

```
src/
├── app/                         routes = the features
│   └── <route>/
│       ├── page.tsx             thin: read params → render <Name>View
│       ├── constants.ts         route-wide constants (used by 2+ of its components)
│       ├── helpers.ts           route-wide pure functions
│       ├── styles.ts            route-level styles (if the project uses style objects)
│       └── _components/         UI used only by this route (and its child routes)
│           └── <Name>/          one component folder, see "Component folder"
├── components/<kebab-name>/     app components reused by 2+ routes, domain-aware
├── lib/
│   ├── api.ts                   the only fetch client (base URL, errors, auth headers)
│   ├── hooks/<domain>.ts        every server call: query / mutation / SSE hooks per domain
│   ├── <responsibility>.ts      shared pure logic named by what it does (format-duration.ts)
│   ├── *-context.tsx, providers.tsx   app-wide client state
│   └── types.ts                 re-exports of contract types (optional)
├── ui/                          design system: generic, domain-free primitives
│                                (or components/ui, or a workspace package)
└── test/                        test setup
messages/<locale>/<namespace>.json   user-visible strings (if the project uses i18n)
```

## Where does X go? (decision table)

Ask **"who uses it?"** before **"what is it?"**. Start at the narrowest scope that has
all current consumers; never place code for a consumer that doesn't exist yet.

| You have… | Used by… | Put it in |
|---|---|---|
| A component | one route | `app/<route>/_components/<Name>/` |
| A component | one parent component only | `<Parent>/_components/<Name>/` (nested) |
| A component | 2+ routes, knows the product domain (order, invoice, project) | `src/components/<kebab-name>/` |
| A component | anywhere, domain-free (button, modal, chart) | the design system (`ui/`) + export from its entry point |
| Trivial layout atoms (label+value rows) for one parent | one parent | `<Parent>/_components/atoms.tsx` — one file, no logic |
| Data from the API (query, mutation, SSE) | anyone | `lib/hooks/<domain>.ts` via `lib/api.ts` |
| A UI-only hook (keyboard, hover, positioning) | one component | `<Name>/use<Thing>.ts` in that folder |
| A UI-only hook | a shared component's parts | `components/<name>/hooks/use<Thing>.ts` |
| A constant (config, thresholds, enum→label/colour maps) | one component | `<Name>/constants.ts` |
| A constant | several components of one route | `app/<route>/constants.ts` |
| A constant | 2+ routes | the owning module in `lib/` (`lib/order-status.ts`), or design tokens if it is visual |
| A pure function (format, derive, sort, map DTO→view) | one component | `<Name>/helpers.ts` |
| A pure function | one route | `app/<route>/helpers.ts` |
| A pure function | 2+ routes | `lib/<responsibility>.ts` — named by what it does |
| A type | one file | inline in that file |
| A type | the API contract | the shared contracts (server side first, then the client's copy if it has one) |
| A type | several client files, not a contract | export it next to the code that owns it (a hook's result type in that hook's file) |
| Styles | one component | `<Name>/styles.ts` / `<Name>.module.css` / Tailwind classes inline — whatever the project uses |
| User-visible text | anywhere | the i18n message files + the project's translation hook, when the project has i18n |
| App-wide client state (current account, theme, toasts) | many routes | a provider in `lib/*-context.tsx` / `lib/providers.tsx` |

## Component folder

```
<Name>/
├── <Name>.tsx        the component (named export, PascalCase = folder name)
├── index.ts          exactly: export { <Name> } from "./<Name>";
├── constants.ts      optional — only if there are constants
├── helpers.ts        optional — pure functions, no React
├── styles.ts         optional — style objects / or <Name>.module.css
├── use<Thing>.ts     optional — UI hook used only here
├── <Name>.test.tsx   RTL test; helpers.test.ts for non-trivial helpers
└── _components/      optional — children used only by <Name>
```

Create only the files that have content — an empty `constants.ts` is noise. If the
project already uses a different casing for folders (e.g. PascalCase inside routes,
kebab-case in `src/components/`), keep it; consistency beats any single convention.

## Splitting a component

Split when one of these is true — not because of a line count alone:

1. **It has two reasons to change.** A tab that renders a list *and* owns a filter bar →
   `FilterBar` + list. (Thinking in React: one component, one job.)
2. **A block has its own state or effects** that the rest doesn't need → move it down
   into a child so the state is colocated with its only reader and re-renders stay local.
3. **The JSX needs a comment to say what a block is** → that block is a named component.
4. **The file mixes pure logic with rendering.** Move derivations, formatting, sorting
   and geometry into `helpers.ts` (testable without React); move data access into a
   `lib/hooks` hook. The component then reads: hooks at the top, derived values, JSX.
5. **It grows past ~200–250 lines.** Treat as a prompt to look for 1–4, not a hard cap.

Do not split into a "container" and a "presentational" twin by default — a custom hook
already separates logic from markup. Do not extract a child that is used once and has
no state, no logic and < ~15 lines of JSX; inline is easier to read.

When a parent passes the same 5+ props through a child to a grandchild, or keeps adding
boolean props (`isCompact`, `isInline`, `showX`), prefer composition: pass `children`
or explicit variant components instead of more flags.

## Pages

`page.tsx` reads params/search params and renders one `<Name>View` from
`_components/`. Data fetching, filtering, sorting and tab logic go in the view, its
hooks and its helpers — not in the page. With RSC, the page may also do the server-side
fetch and pass data down; it still doesn't hold UI logic. Fat existing pages: don't grow
them; when you touch one, move the new logic into `_components/` or `helpers.ts`.

## Business logic: which layer

The backend owns business rules. What the client has, from outside in:

| Layer | Lives in | Contains | Must not contain |
|---|---|---|---|
| View | `*.tsx` components | JSX, event wiring, calling hooks | `fetch`, raw query keys, non-trivial calculations |
| UI state | `useState` in the lowest component that needs it; URL (`?tab=`, `?status=`) when it must survive reload/share | toggles, inputs, open/closed | server data copied into state |
| Server state | `lib/hooks/<domain>.ts` (React Query / SWR) | query keys, fetchers, invalidation, polling, success/error notifications | JSX |
| Transport | `lib/api.ts` | the fetch wrapper, the API error type, base URL | domain knowledge |
| Pure logic | `helpers.ts` / `lib/<responsibility>.ts` | derivations, formatting, mapping DTO → view model | React, I/O |

Rules that follow from this:
- Components never call `fetch` or the API client directly; they call a hook from
  `lib/hooks` (or receive data from an RSC parent).
- Keep server data in the server-state cache, not copied into `useState`/context —
  derive during render instead (react.dev "You Might Not Need an Effect").
- Query keys stay inside their domain file next to the hook that uses them; a mutation
  invalidates the keys of its own domain. Never build a key in a component.
- If logic would be duplicated with the server, it belongs on the server behind the
  contract; the client renders what the API returns (e.g. totals, counts, permissions).

## Imports and boundaries

Allowed direction (arrows = "may import"):

```
app/<route>  ──►  components/  ──►  lib/  ──►  ui/ (design system), contracts
     └───────────────────────────────►┘
```

- The design system and contracts never import from `app/`, `components/` or `lib/`.
- `lib/` never imports from `app/` or `components/`.
- `components/` never imports from `app/`.
- A route never imports from **another route's** `_components/` (private by name). If
  two routes need the same thing, promote it (see below) instead of a deep import like
  `@/app/orders/[id]/_components/LineItems/helpers`.
- Use the path alias (`@/…`) for anything outside the current route folder; `./` and
  `../` only within it.

### index.ts / barrels

- **Component folder:** a one-line `index.ts` re-exporting the component (and its public
  prop types if consumers need them). Import the folder: `from "./_components/OrderRow"`.
- **Package entry points:** the design system and the contracts package each have one
  entry point; always import from it, never from an internal layer file.
- **Public surface of a shared component:** `components/<name>/index.ts` lists what is
  public, explicitly (`export { DataTable } …; export type { DataTableColumn } …`).
- **Do not** add aggregating barrels, i.e. an `index.ts` that re-exports *several*
  modules of a folder (`components/index.ts`, `helpers/index.ts`). They create import
  cycles, slow tests and builds, and hide where code lives. (`export * from "./PageShell"`
  in a component's own `index.ts` is a single re-export, not an aggregating barrel.)
  A common, acceptable exception is `lib/hooks/index.ts` as the data layer's entry point
  — if the project has one, add every new domain file to it.

## Promotion: when code moves up

Code starts local and moves up **when the second consumer appears**, not before:

1. Same route, second component needs it → move from `<Name>/helpers.ts` to the route's
   `helpers.ts` / `constants.ts`, or to the nearest common parent's folder.
2. Second route needs it → component to `src/components/<kebab-name>/`; pure function
   or constant to `lib/<responsibility>.ts`.
3. It turns out to be domain-free and generic → the design system (with a showcase/story
   entry if the project keeps one).

Move the code, its test and its i18n keys together, update imports, and leave no
re-export at the old path. Prefer a little duplication over an abstraction with one
real user or one that needs flags to serve both callers ("prefer duplication over the
wrong abstraction").

## Naming

- Components and their files: PascalCase, file name = component name.
- Hooks: `use<Thing>`; data hooks named after the resource (`useOrders`, `useDeleteOrder`).
- `lib/` modules: kebab-case, named by responsibility (`format-duration.ts`,
  `order-status.ts`). Never `utils.ts`, `common.ts`, `misc.ts` — a generic name becomes a
  dumping ground. (A framework-mandated file such as shadcn's `lib/utils.ts` with `cn()`
  is fine; don't add more to it.)
- `helpers.ts` is fine *inside* a component or route folder: the folder already says
  whose helpers they are.
- Constants: `SCREAMING_SNAKE_CASE`, with a one-line doc comment for units or meaning
  (`/** Grace period to move the pointer into the card. */ CLOSE_DELAY_MS`).
- Keep nesting shallow: a `_components` inside a `_components` is fine; a third level
  means the middle component is doing too much or its children are really siblings.

## Checklist before finishing a frontend change

- [ ] Every new file is at the narrowest scope that covers its current consumers.
- [ ] No component calls `fetch`/the API client; new server calls are hooks in `lib/hooks/<domain>.ts` (and exported from the hooks entry point if the project has one).
- [ ] No import reaches into another route's `_components/`; no new aggregating barrels.
- [ ] Pure logic sits in `helpers.ts`/`lib/*.ts` with a test when it has branches.
- [ ] Strings go through i18n if the project has it; colours use design tokens / CSS variables.
- [ ] Folder holds only files with content; `index.ts` is a single re-export.
- [ ] If something was promoted, the old path is gone and all imports point at the new one.

For worked examples (good placements, common deviations and how to fix them, and
"where does this go?" walkthroughs), read `${CLAUDE_SKILL_DIR}/references/examples.md`.
