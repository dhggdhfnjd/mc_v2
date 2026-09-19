# CLAUDE.md

Mizani is a Cloud Phone (CloudMosa) widget for keypad phones: farm prices, price history and a buyer-demand map for informal cross-border traders at Busia (Kenya–Uganda). Competition entry for the CloudMosa track. The app is a three-level menu — main menu, view, detail — drawn as numbered icon cells; the tree and the screen behind each node are in `docs/ARCHITECTURE.md`.

## Commands

- `npm run dev` – dev server (the Claude preview config `mizani` runs it on port 3100)
- `npm test` – Vitest unit tests for `app/lib/money.ts` and `app/lib/trust.ts`
- `npm run typecheck` / `npm run lint`
- `npm run build` – static export to `out/` (set `NEXT_PUBLIC_BASE_PATH=/<repo>` for GitHub Pages)
- `worker/` is the API (Cloudflare Worker + D1) for accounts and buyer posts: `npm run db:init`, `npm run dev`, `npm run typecheck` from that directory. Point the app at it with `NEXT_PUBLIC_API_BASE`. The photo recogniser in `server/` has its own variable, `NEXT_PUBLIC_VISION_BASE`.

## Platform rules (from the official Cloud Phone docs and the Meichu demo repo)

- Stack mirrors `cloudmosa/cloudphone-2025meichuhackathon-demo`: Next.js 15 App Router, `output: 'export'`, React 19, TypeScript, Tailwind 4, deploy to `gh-pages`.
- Keys: `Escape` = left soft key, `Enter` = centre, arrows, digits, `*`, `#`. Right soft key = the global `back` event on devices and `F12` in the demo/simulator convention. Always switch on `event.key` (`#` shares a keyCode with `3`). All of this lives in `app/core/keypad.ts` and `app/core/keys.tsx` — screens only see `Key` values.
- Screens: QVGA 240×320 (`.qv`) and QQVGA 128×160 (`.qq`). A viewport ≤ 330 px wide renders bare (full screen); anything larger renders the desktop phone frame.
- The browser runs in CloudMosa's data centre and streams draw commands: no animations or transitions, no spinners, no polling, prefer SVG/text over bitmaps, one API call per screen.
- No offline mode, no push, no background work on Cloud Phone. `tel:` needs client 3.1.2+; uploads and `getUserMedia` do not work in the simulator. Gate features with `app/core/features.ts` (`navigator.hasFeature`).
- Widget registration needs an HTTPS URL, an 80×80 icon (`public/icon-80.png`) and a name.

## Architecture

- `app/lib/` – pure domain code, no React: `money.ts` (integer money maths, fair band, verdict, counter-offer), `trust.ts` (crowd-price gates, weighted median, confidence), `catalog.ts`, `seed.ts` (deterministic demo data), `api.ts` (Promise API that mirrors the planned REST endpoints; in-process for now), `vision.ts` (photo → crop: MobileCLIP-S0 zero-shot in the page via ONNX Runtime Web, the same model over HTTP from `server/`, colour histogram as last resort; label table built by `tools/vision/build_label_embeddings.py`).
- `app/core/` – platform layer: `keypad.ts`, `textentry.ts` (multi-tap alphabet; `<input>` never sends keydown on Cloud Phone), `keys.tsx` (key bus), `router.tsx` (screen stack on the History API so the RSK default `history.back()` pops one screen; its root is a prop, and signing in or out remounts it), `session.tsx`, `features.ts`, `settings.tsx`, `useApi.ts` (last-good cache fallback), `errors.ts`, `i18n.ts`, `display.ts`.
- `worker/` – the API: one Worker over D1 (SQLite), accounts and buyer posts (`demands`; rules shared with the browser in `app/lib/demand.ts`). `users.username` is the primary key and the identity shown on the buyer map; `app/lib/auth.ts` is imported by both the browser and the Worker so there is one KDF (PBKDF2-SHA256) and one set of validation rules.
- `app/screens/` – one screen per node of the menu tree; registry in `index.ts`.
- `app/components/` – `Screen` (header/body/soft keys + key registration), `ui` (`Grid`/`useGridNav` for the icon menus, Row, Field, Bars, Spark), `PhoneFrame` (desktop only).

## Conventions

- Every menu option is an icon plus its word in a numbered cell (`Grid`), never a bare text row: one look, one digit.
- Internal prices are KES cents per kg (`*C`); totals are whole KES; convert only at the display edge (`core/display.ts`).
- No LLM or randomness in money paths. Anything that changes `money.ts`, `trust.ts` or `auth.ts` needs a test.
- Signed out, the app is the login screen and nothing else: a buyer post carries the account's name, so there is no anonymous mode. API errors travel as the `AuthCode` names, which are also i18n keys.
- Keep strings short (≈26 characters per line at 240 px). Kiswahili strings need native review.
- All prices in the prototype are demo data; say so wherever numbers are shown to judges.
- `public/ort/` is copied from `node_modules` by `scripts/copy-ort.mjs` on install and is git-ignored; `public/models/*.onnx` is committed. Do not switch to the Hub's int8 model: it scores 0% (measured).
