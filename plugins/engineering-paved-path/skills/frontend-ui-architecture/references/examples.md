# Worked examples

Illustrative placements for the rules in `SKILL.md`, using a generic order-management app.
Paths are relative to the client's `src/`. Map them to the project's real folders.

## Contents
1. Placements to copy
2. Common deviations (fix them when you touch the file)
3. Walkthroughs: "where does this go?"

---

## 1. Placements to copy

**A component folder with every optional file**
`app/orders/_components/StatusCell/`
- `StatusCell.tsx` holds the rendering, event wiring and data hook (`useOrderEvents`).
- `constants.ts` holds `STATUS_ORDER` and the hover-card geometry `CARD_WIDTH`, `CLOSE_DELAY_MS`, each with a doc comment for its unit.
- `helpers.ts` holds pure functions (`statusHref`, `latestEvent`, `cardPosition`). They are testable without React, and `cardPosition` takes the viewport as an argument rather than reading `window`.
- `styles.ts` (or `StatusCell.module.css`) holds the styles; dynamic style entries are functions (`card(pos)`).
- `index.ts` is a single `export { StatusCell } from "./StatusCell";`.

**Nested private children**
`app/products/[id]/_components/ProductEditor/_components/PricingTab/`
`PricingTab` is used only by `ProductEditor`, so it lives inside the editor's folder rather than next to it.

**Layout atoms in one file**
`app/orders/[id]/_components/ShipmentDrawer/_components/atoms.tsx`
`Stat` and `Row` are trivial presentational helpers with no logic. They are grouped in one file and never tested alone.

**Route-wide constants and helpers**
`app/orders/constants.ts` (`STATUS_META`, `GRID`, size thresholds) and
`app/orders/helpers.ts` (`sizeOf`, `relativeTime`) serve the page, `OrderRow` and `FilterBar` of that route.

**Shared app component with an explicit public surface**
`components/data-table/index.ts` exports only `DataTable` and `type DataTableColumn`. Inner parts (`HeaderCell`, `Pagination`, `RowMenu`) stay private to the folder.

**UI hooks for a shared component**
`components/app-shell/hooks/`: `useGlobalShortcuts`, `useCommandPalette`, `useShellContext`.
These hooks hold UI behaviour only and make no server calls.

**Data layer**
`lib/hooks/orders.ts`: `useOrders`, `useOrder`, `useOrderEvents`, `useCancelOrder`…
Each hook keeps its query key, its fetcher over `lib/api.ts`, its polling interval and the related types (`OrderSummary`) in one file. If the project has `lib/hooks/index.ts`, it re-exports every domain file.

**Shared pure logic named by responsibility**
- `lib/carrier-urls.ts` builds tracking deep links (`trackingUrl`, …).
- `lib/money.ts` formats amounts. It is used by the orders route and the invoices route, which is two routes, so it lives in `lib/`.
- `components/price-badge/helpers.ts` holds a formatting helper only that component needs. It stays with the component that owns it.

**Thin pages**
`app/products/page.tsx`, `app/onboarding/page.tsx` and `app/settings/[section]/page.tsx` are each under ~10 lines and only render a `_components/<Name>View`.

## 2. Common deviations (fix them when you touch the file)

| Shape | What | Fix |
|---|---|---|
| A route component imports helpers from **another route's** `_components/` | Private code of one route used by another (deep import) | Two routes use it, so promote it to `lib/<responsibility>.ts`, move its tests, and update both routes' imports. |
| A list page holds filtering, sorting and URL-state logic itself | Fat page | Move it into `_components/<Name>View` plus the route's `helpers.ts` (`filterOrders`, `sortOrders`). |
| A 150+ line client page holding tabs, polling and cancel logic | Fat page with several jobs | Don't grow it. New logic goes to `_components/`; extract a `<Name>View` when you next touch the page. |
| Deep relative imports (`../../../../../lib/hooks`) | Hard to read and to move | Switch to the path alias (`@/lib/hooks`, `@/components/app-shell`). |
| A component calls `fetch` or the API client directly | Data access in the view | Add a hook in `lib/hooks/<domain>.ts` and call it. |
| `lib/utils.ts` growing unrelated helpers | Dumping ground | Split by responsibility (`lib/money.ts`, `lib/dates.ts`); keep only what the framework mandates. |
| `components/index.ts` re-exporting everything | Aggregating barrel | Delete it and import each component folder directly. |

## 3. Walkthroughs: "where does this go?"

**"Add a category filter next to the status chips in the Orders list."**
Only `OrdersPanel` uses it. It already renders status chips inline, and a second chip row gives the panel a second job, so extract `OrdersPanel/_components/CategoryFilter/`. Put the predicate next to the status one in `OrdersPanel/helpers.ts`, with a case in `helpers.test.ts`. The selection is UI state, so hold it in `useState` in `OrdersPanel`, or in `?cat=` if it should survive a reload. Chip labels come from the design tokens and i18n messages, not hard-coded strings.

**"Show the price badge on the product page too."**
`PriceBadge` is already in `src/components/price-badge/`, so import it from `@/components/price-badge`. Do not copy it into the products route.

**"We need to call `GET /products/:id/stats`."**
Add `useProductStats(id)` to `lib/hooks/products.ts`, with its query key next to the other product keys. Add the response type to the shared contracts (server side first). The component calls the hook and never calls the API client.

**"Format a duration as `1m 23s` in the shipment drawer."**
While only the drawer needs it, it goes in `ShipmentDrawer/helpers.ts`. When the order list also needs it, move it to `lib/format-duration.ts` and delete the old copy. Don't create `lib/utils.ts` for it.

**"A new generic `Tooltip` for everything."**
A tooltip has no domain knowledge, so it belongs to the design system. Put it in the design-system folder, export it from its entry point, add it to the showcase/stories if the project has them, and import it from that entry point.

**"`ProductCard` needs a colour map for product status that `ProductEditor` also uses."**
`ProductCard` is in `app/products/_components/` and `ProductEditor` is in `app/products/[id]/_components/`. These are two route folders, but one is nested under the other, so the nearest common owner is `app/products/`. Put the map in `app/products/constants.ts`. Promote it to `lib/` only when a route outside `products/` needs it.
