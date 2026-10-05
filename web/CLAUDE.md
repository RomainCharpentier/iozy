# Web (React 19 + TypeScript + Vite 8 + TanStack Query + Tailwind v4)

The living client. It always calls `/api/...` with a **relative** URL (Vite proxy in dev, nginx in prod), never an absolute URL to the backend.

## Commands

All from `web/`. The backend must run for dev (`cd ../backend && docker compose up --build`).

```bash
npm run dev              # :5173, proxies /api to :8080
npm test                 # Vitest, about 2 s: run it first, then at each step
npm run typecheck        # tsc -b --noEmit: THE type check
npm run lint             # oxlint: must print NOTHING (zero warnings)
npm run check:contrast   # all colour pairs of both themes >= 4.5:1 (WCAG AA)
npm run check:frontieres # import rules between pages and common
npm run build            # tsc -b && vite build
npm run test:e2e         # Playwright, its own Docker stack (API :8090), about 45 s
npm run check:pwa        # manifest and icons keep their promises
npm run check:deploiement http://localhost:8081   # GET checks against a served app
```

**`npx tsc --noEmit` checks nothing.** The root `tsconfig.json` is `files: []` plus references, so it always exits 0. Use `npm run typecheck`. To read an exit code, do not use a pipe.

Before a commit: `npm test`, `typecheck`, `lint`, and `check:contrast` if you touched a colour. Run `check:deploiement` after any change to nginx or the Dockerfile.

## Layout (`src/`)

- `app/`: router, providers, shell (`App.tsx`).
- `pages/`: **one page = one folder**, named like its URL. Sub-pages are sub-folders. Inside: the page, its components, its hooks, its tests.
- `common/`: what **several pages** share, nothing else: `components/` (design system: `Carte`, `Chip`, `Jaquette`, `GrilleVolumes`, … and `layout/`), `hooks/`, `lib/`, `api/`, `types/`, `theme/`.
- `test/`: Vitest setup and `fixtures.ts`.

Rules: a module used by **one page only** lives in that page. As soon as a **second page** needs it, it moves to `common`. A page composes, it does not compute: data in hooks, display in components. Import with the `@/` alias (`@/common/api/entities`), never `../../..`.

## How to

- **API call**: in `common/api/<domain>.ts` (create the module if the domain is new), never in a component. Request and response types go in `common/types/api.ts`, with the same camelCase names as the Java DTOs.
- **Screen**: a new folder under `pages/` and one route in `app/App.tsx`. Reuse `common/components/` and the tokens (`common/theme/tokens.ts`, Tailwind classes from `src/index.css`: `bg-surface`, `text-textDim`, `text-accent`, `font-display`, …). No hard-coded colours or sizes.
- **Cache**: keys in `common/lib/queryKeys`, invalidations in `common/lib` too. A form wired to the wrong route, or a cache that is not invalidated, breaks no rule: the screen just stays on the old state. The e2e flows catch this.

## Tests

- Vitest + Testing Library. Put `*.test.ts(x)` **next to the module it tests** (no `__tests__` folder). No `globals: true`: import `describe`/`it`/`expect`.
- `src/test/fixtures.ts` builds the server objects (`oeuvre`, `tome`, `possession`, `edition`, `tag`). A test names only what matters to it.
- A test is worth writing if it guards a **rule that breaks silently** (an unknown total you must not guess, one signal per card, a sentence that promises something). Check the **text read on screen**, never a CSS class or a `data-testid`.
- A test is useful if it fails when you break its rule. To check: `node scripts/mutation.mjs <file> "<text>" "<replacement>"`. It mutates every match, runs the suite, restores the file, and exits with an error if nothing fails.
- **E2E** (`e2e/*.spec.ts`): they start logged in (`compte.setup.ts` opens the session once). The test stack has **no provider key**. The flows use a collection type created for the occasion (free entry), never Jikan or Google Books. A second account is created on screen with `CODE_INVITATION` (`e2e/compte.ts`). To keep the stack after a failure: `IOZYCORE_E2E_GARDER_LA_PILE=1 npm run test:e2e`.

## Check the UI in the app browser

The built-in browser **draws no frames**. `requestAnimationFrame`, `ResizeObserver` and screenshots do nothing there. Check by measurement (`getBoundingClientRect`, `read_page`, text) instead of screenshots. To see a **logged-in screen with data**: keep the e2e stack + use `web-e2e` (`.claude/launch.json`, :5174 → API :8090) + replay the Playwright session in a script. Do not touch the real collection.

To judge a screen, take screenshots on **mobile (390×844) and desktop (1280×900), dark and light theme**. The app is mobile-first, and what a screen shows with data cannot be read in the code. The e2e flows only create series without covers, so seed a believable collection (AniList metadata search, then `quick-add`, cover key `coverImageUrl`). On mobile, a page that overflows widens the render window. This is the sign of an overflow.

## Accessibility and design

- AA contrast in both themes (the script checks it). Touch targets, accessible names and focus order are part of the work, not a last pass.
- Reference mockups are in `../design_handoff_v2/`. If there are several boards of the same screen, ask the owner **before** you code.
- The log of UI batches is `../docs/DESIGN_MIGRATION_V1.2.md`. Add one section per batch.

## PWA and deployment

The PWA is installable in **production only** (`sw.js` is registered from `main.tsx`. An app-shell cache would get in the way of hot reload). The service worker caches the shell, **never `/api`**: data served from a cache would be an old collection shown as the real one. nginx traps already fixed in `nginx.conf`: `.webmanifest` has no MIME type by default, and `sw.js` needs `Cache-Control: no-cache`. A stale nginx container on :8081 is fixed with `docker compose build web` then `up -d --force-recreate web`.

Camera scan (`/scan`) uses `BarcodeDetector` (Chrome/Edge, Android). Safari and Firefox fall back to typing the ISBN.
