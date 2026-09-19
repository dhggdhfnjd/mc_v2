# Mizani

A bargaining co-pilot for keypad phones on [Cloud Phone](https://www.cloudphone.tech/), built for informal cross-border traders and farmers at Busia on the Kenya–Uganda border. *Mizani* is Kiswahili for "scales".

It answers the four questions a trader has at the stall: **what is the price, what is this lot worth, is their offer acceptable, and where else could I sell.**

> Prototype. All prices, exchange rates and seasonal curves are deterministic demo data standing in for KAMIS (Kenya), WFP/HDX and other traders' phones.

## Try it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. On a desktop the app renders inside a phone frame with a clickable keypad; on a viewport of 330 px or less (a real Cloud Phone, or the Cloud Phone Simulator) it fills the screen. Add `?bare=1` or `?size=qq` to force a mode.

| Key | Action |
| --- | --- |
| `1`–`9` | pick a crop from the 3×3 grid; type numbers on any screen (no input box to focus) |
| `↑ ↓ ← →`, `Enter` | move / confirm |
| `Esc` (or `Q`) | left soft key: menu or the screen's main action |
| `F12` (or `W`), and the Cloud Phone `back` event | right soft key: clear a digit, otherwise back; at the root the widget closes |
| `*` / `#` | pin a crop / switch KSh ↔ USh |

A two-minute tour: `1` Maize → type `2` bags → `Enter` → type their offer `4250` (red verdict, money lost on the lot, counter-offer, a better buyer elsewhere) → `Enter` → save the deal → back on the price screen the traders' count and median have moved. Then `Esc` → *Where to sell* → `Esc` for the bubble map.

## What is in it

Every screen implements one decision from the team's 19 Sep 2026 design discussion (D-numbers, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

| Screen | Decision | What it does |
| --- | --- | --- |
| Home | D1 | 3×3 crop grid mapped to the digit keys; favourites are pinned to the front; `0` opens the photo recogniser |
| Area | D2 | choose your market once; it is remembered |
| Price | D3, D14 | official per-kg price (always dated) above the traders' reported price with confidence bars; unit and grade pickers; type the quantity |
| Calc | D4 + bargaining | lot value, fair range, verdict on their offer, money at stake, next price to say, best alternative buyer, own cost floor |
| Show card | — | a light, large-type price card to turn towards the other party |
| Deal done? | D5, D12, D13 | final price, change calculator, optional photo; saves to the ledger and becomes an anonymous price report |
| Where to sell | D7, D8 | demand board ranked by price *net of transport*, as a list and as a D-pad-navigable bubble map of the Busia corridor |
| History / Season | D9, D10 | trend sparkline; twelve-month "fare calendar" with a store-or-sell estimate |
| Report price | D11 | side, grade, price; goes through the trust gates |
| My deals | D12 | weekly summary, performance against the market, trust stars |
| Border & FX | — | KSh ↔ USh converter that prices a street exchange rate; EAC Simplified Trade Regime card |

### Crowd-price trust (D13–D15)

No identity checks. `app/lib/trust.ts`: reports below half or above double the official price are refused; reports more than 20% from both the official price and the current median are quarantined until two other devices corroborate them; one vote per device; weighted median with a 3-day half-life; behaviour-based reputation (0.3 → 1.0); photo and completed-deal bonuses; buyer and seller medians balanced; nothing is shown below three independent reporters. Try it: report maize at 900 (refused) or 40 (held).

## Cloud Phone compliance

| Requirement (official docs / Meichu demo repo) | Here |
| --- | --- |
| Widget = HTTPS URL + 80×80 icon + name | GitHub Pages export; `public/icon-80.png`; "Mizani" |
| Next.js static export, GitHub Actions → `gh-pages` | `next.config.ts`, `.github/workflows/deploy.yml` (tests run first) |
| QVGA 240×320 and QQVGA 128×160 | `.qv` / `.qq` size classes; optional rows drop out on QQVGA |
| LSK = `Escape`, centre = `Enter`, RSK = `back` event (devices) / `F12` (demo convention) | `app/core/keypad.ts`, `app/core/keys.tsx` |
| RSK default is `history.back()`; exit at the root | screen stack on the History API, `app/core/router.tsx` |
| `navigator.hasFeature()` before using uploads, `tel:`, SMS | `app/core/features.ts`; controls are not rendered when unsupported |
| Remote browser streams draw commands; updates cost data | no animation, no spinners, no polling, SVG instead of bitmaps, one API call per screen |
| No offline mode on Cloud Phone | last-good cache per screen (`app/core/useApi.ts`); Settings → Network (demo) simulates a flaky or dead connection |

The same build is an installable PWA on smartphones (`public/manifest.webmanifest`, `public/sw.js`) — that is where buyers would post demand.

## Project layout

```
app/
  lib/         pure domain code: money.ts, trust.ts (+ tests), catalog.ts, seed.ts, api.ts, vision.ts
  core/        platform layer: keypad, key bus, router, feature detection, settings, useApi, i18n
  components/  Screen shell, rows/fields/sparkline, desktop PhoneFrame
  screens/     one file per screen; registry in index.ts
public/        icons, manifest, service worker
```

`app/lib/api.ts` exposes Promise functions named after the planned REST endpoints (`GET /v1/prices`, `POST /v1/deals`, …). Today they run in-process over seeded data and localStorage; pointing them at a Workers backend does not touch the screens. Set `NEXT_PUBLIC_API_BASE` to switch photo recognition from the on-device colour demo to `POST /v1/recognize`.

## Scripts

`npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` (static export to `out/`; set `NEXT_PUBLIC_BASE_PATH=/<repo>` for GitHub Pages).

## Deploying and registering the widget

1. Push to `main`. The workflow tests, builds and publishes `out/` to the `gh-pages` branch; enable Pages with *Deploy from a branch → gh-pages*.
2. Sign in at <https://www.cloudphone.tech/my>, add a widget with the Pages URL, `public/icon-80.png` and the name, then open it in the Cloud Phone Simulator (Chrome only; uploads and the microphone do not work there).
3. To test on a handset, enable developer mode (Settings → About → press the left soft key 7 times) and add the device IMEI in the portal.

## Known limits

Demo data only; Kiswahili strings need native review; unit weights (gorogoro, debe, crate) need field calibration; photo recognition is a colour heuristic until the vision endpoint exists; image upload, `#`/`*` key values and soft-key events still have to be confirmed on the itel test handset.
