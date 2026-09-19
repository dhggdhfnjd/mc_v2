# CLAUDE.md

Mizani is a Cloud Phone (CloudMosa) widget for keypad phones: farm prices, deal maths, bargaining help and a demand board for informal cross-border traders at Busia (Kenya–Uganda). Competition entry for the CloudMosa track; the team's decisions are numbered D1–D15 in `docs/ARCHITECTURE.md` and every screen maps to one of them.

## Commands

- `npm run dev` – dev server (the Claude preview config `mizani` runs it on port 3100)
- `npm test` – Vitest unit tests for `app/lib/money.ts` and `app/lib/trust.ts`
- `npm run typecheck` / `npm run lint`
- `npm run build` – static export to `out/` (set `NEXT_PUBLIC_BASE_PATH=/<repo>` for GitHub Pages)

## Platform rules (from the official Cloud Phone docs and the Meichu demo repo)

- Stack mirrors `cloudmosa/cloudphone-2025meichuhackathon-demo`: Next.js 15 App Router, `output: 'export'`, React 19, TypeScript, Tailwind 4, deploy to `gh-pages`.
- Keys: `Escape` = left soft key, `Enter` = centre, arrows, digits, `*`, `#`. Right soft key = the global `back` event on devices and `F12` in the demo/simulator convention. Always switch on `event.key` (`#` shares a keyCode with `3`). All of this lives in `app/core/keypad.ts` and `app/core/keys.tsx` — screens only see `Key` values.
- Screens: QVGA 240×320 (`.qv`) and QQVGA 128×160 (`.qq`). A viewport ≤ 330 px wide renders bare (full screen); anything larger renders the desktop phone frame.
- The browser runs in CloudMosa's data centre and streams draw commands: no animations or transitions, no spinners, no polling, prefer SVG/text over bitmaps, one API call per screen.
- No offline mode, no push, no background work on Cloud Phone. `tel:` needs client 3.1.2+; uploads and `getUserMedia` do not work in the simulator. Gate features with `app/core/features.ts` (`navigator.hasFeature`).
- Widget registration needs an HTTPS URL, an 80×80 icon (`public/icon-80.png`) and a name.

## Architecture

- `app/lib/` – pure domain code, no React: `money.ts` (integer money maths, fair band, verdict, counter-offer), `trust.ts` (crowd-price gates, weighted median, confidence), `catalog.ts`, `seed.ts` (deterministic demo data), `api.ts` (Promise API that mirrors the planned REST endpoints; in-process for now), `vision.ts` (photo → crop providers).
- `app/core/` – platform layer: `keypad.ts`, `keys.tsx` (key bus), `router.tsx` (screen stack on the History API so the RSK default `history.back()` pops one screen), `features.ts`, `settings.tsx`, `useApi.ts` (last-good cache fallback), `i18n.ts`, `display.ts`.
- `app/screens/` – one screen per team decision; registry in `index.ts`.
- `app/components/` – `Screen` (header/body/soft keys + key registration), `ui` (Row, Field, Bars, Spark), `PhoneFrame` (desktop only).

## Conventions

- Internal prices are KES cents per kg (`*C`); totals are whole KES; convert only at the display edge (`core/display.ts`).
- No LLM or randomness in money paths. Anything that changes `money.ts` or `trust.ts` needs a test.
- Keep strings short (≈26 characters per line at 240 px). Kiswahili strings need native review.
- All prices in the prototype are demo data; say so wherever numbers are shown to judges.
