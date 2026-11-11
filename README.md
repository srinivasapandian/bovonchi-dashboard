# BOVONCHI Dashboard

Merchant dashboard for the Bovonchi storefront, styled to match [bovonchi-demo.brisquedemo.com](https://bovonchi-demo.brisquedemo.com/)
(ivory paper, warm ink, antique gold; Cormorant Garamond + Jost).

Vite + React 19 + TypeScript. It combines three sources:

| Feature | Ported from | Where it lives |
| --- | --- | --- |
| **Staff sign-in** (business name / user ID / password) | `Maghil-Merchant-Portal` (`/merchants/staff/login`, HMAC + encrypted responses) | `src/pages/LoginPage.tsx`, `src/context/AuthContext.tsx`, `src/services/api.ts`, `src/utils/hmac-utils.ts` |
| **Orders - "Scroll"** (tabs, search, column picker, date, sort, infinite scroll, receipt drawer) | `MerchantApp` Scroll screen (`POST api/v2/orders/filter`, `GET api/v2/orders/{id}`) | `src/features/orders/` |
| **Product Catalog** (items, categories, menus, set menus, combos, modifiers, variations, sessions, kitchen stations, availability control centre, sync history) | `Maghil-Merchant-Portal` `components/productCatalog` + its redux/services | `src/components/productCatalog/`, `src/redux/productCatalog/`, `src/services/*CatalogApi.ts` |

## Run

```bash
npm install
cp .env.example .env     # then fill in VITE_E_KEY (the backend response-encryption key)
npm run dev              # http://localhost:3000
```

`npm run build` produces `dist/`. `npm run typecheck` runs `tsc`.

### Environment

See `.env.example`. The `*_ENDPOINT` values are the full API URLs (the staging backends accept browser calls from
`localhost`, so no dev proxy is needed); point them at production for a production build.
`VITE_MOCK_ORDERS=true` (dev only, via `.env.local`) serves the Orders screen from fixtures in `src/features/orders/ordersMock.ts`.

## Theming

All design tokens are in `src/index.css`. The catalog screens read the Merchant Portal's short names (`--accent`, `--t1`,
`--card-border`, `--radius-button`, ...); those are aliased to the Bovonchi palette (`--bv-*`) in the "Portal aliases" block, so
changing the brand colour is a one-line edit. Hard-coded hex colours in the ported catalog code were remapped to the same palette.

## Layout

```
src/
  components/layout/      Bovonchi shell: Sidebar (Orders + Product Catalog group), TopBar, DesktopLayout, user menu
  components/BottomNav    mobile tab bar
  components/productCatalog/  ported catalog screens (unchanged structure, so upstream diffs stay easy)
  features/orders/        Scroll: api, paging hook, table, drawer
  pages/LoginPage.tsx
  shims/                  web stand-ins for the Capacitor plugins the portal code imports
```

## Notes

- Capacitor secure storage is replaced by `localStorage` (`src/shims`, aliased in `vite.config.ts`); the portal's `process.env.REACT_APP_*`
  names are mapped from `VITE_*` in the same file, so the ported code did not need rewriting.
- The catalog's mobile layout (up to 768px) and the Orders cards view use `BottomNav`; desktop uses the sidebar.
- `tsc` reports 5 `call()` overload errors in `src/redux/productCatalog/productCatalogSaga.ts`; they are inherited from the portal source and
  do not affect the Vite build.
