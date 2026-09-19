# Mizani

A bargaining co-pilot for keypad phones on [Cloud Phone](https://www.cloudphone.tech/), built for informal cross-border traders and farmers at Busia on the Kenya–Uganda border. *Mizani* is Kiswahili for "scales".

It answers the four questions a trader has at the stall: **what is the price, what is this lot worth, is their offer acceptable, and where else could I sell.**

> Prototype. All prices, exchange rates and seasonal curves are deterministic demo data standing in for KAMIS (Kenya), WFP/HDX and other traders' phones.

**使用說明書（繁體中文，附每個畫面的截圖）：[docs/USER_MANUAL.md](docs/USER_MANUAL.md)**　·　交接說明：[docs/HANDOVER.md](docs/HANDOVER.md)

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

### Photo recognition

`0` on the home screen, or *Menu → Photo*. The photo is classified by a real vision model, **Apple MobileCLIP-S0**, run zero-shot: each of the 18 catalog crops is described in plain English ("tiny dried fish", "unripe green cooking bananas"…), those descriptions are embedded once offline, and at run time the image embedding is compared with them. No training photos are needed, which matters because nothing off the shelf knows omena, matooke or sukuma wiki. Stock YOLO was considered and rejected: its 80 COCO classes contain none of these crops.

| | top-1 | top-3 | non-crop photos rejected |
| --- | --- | --- | --- |
| Offline, full-size photos (n = 91) | 84.6% | 97.8% | 6 / 6 |
| Offline, simulated 0.08 MP keypad camera (320×240, JPEG q55) | 79.1% | 97.8% | 6 / 6 |
| **In the browser** (ONNX Runtime Web, WASM, 1 thread) | 83.5% | 97.8% | 6 / 6 |

Top-3 is the number that matters: the screen lists three candidates and the trader confirms with one digit. Typical misses are look-alikes (sorghum ↔ millet ↔ beans, ripe bananas ↔ matooke). The photos are 97 hand-curated Wikimedia Commons images, and they guided the prompt wording, so treat the figures as optimistic until field photos exist. About 125 ms per photo on a laptop.

Two ways to run the same model, same label table, same answers:

- **In the page (default).** Image encoder as ONNX with float16 weights and float32 compute (22.9 MB; the 11.8 MB int8 file on the Hub scores 0% — dynamic quantisation breaks this architecture) plus the ONNX Runtime WASM runtime (14 MB), both fetched only when the Photo screen opens. On Cloud Phone the page runs in CloudMosa's data centre, so this costs the handset no data and no CPU.
- **Behind an API.** `server/` is a FastAPI service exposing `POST /v1/recognize`; build the web app with `NEXT_PUBLIC_API_BASE=<url>` to use it. `server/Dockerfile` runs as a Hugging Face Docker Space or on any container host.

If the model cannot load, the app falls back to a colour histogram and says so on screen. Change what a crop "looks like", or add one, in `tools/vision/build_label_embeddings.py`.

Model © Apple Inc., redistributed under its licence (`public/models/LICENSE-mobileclip.txt`); ONNX export from [Xenova/mobileclip_s0](https://huggingface.co/Xenova/mobileclip_s0).

### Map basemap (optional Google Static Maps)

The demand map draws its bubbles on a hand-drawn SVG schematic by default. Build with `NEXT_PUBLIC_GOOGLE_MAPS_KEY=<key>` (CI reads the `GOOGLE_MAPS_KEY` repository secret) and they sit on a real map instead: one dark, label-free Google Static Maps image (zoom 7, 277×226, shown at 240 px) framing all eleven markets. `app/lib/staticmap.ts` projects each market onto it with Web Mercator and pushes overlapping bubbles apart; a thin leader line points back to the true position. The image URL is the same for every food, so changing food only redraws the SVG overlay. If the image fails to load (bad key, quota, offline) the screen falls back to the schematic; `?map=svg` forces the schematic for comparison.

**Near me** (main menu `7`) centres the same kind of map on the phone and draws a 100 km circle with the markets inside it numbered by distance; OK makes the selected one your area. The location comes from `?at=lat,lon` (for demos), then `navigator.geolocation`, then the market you picked, and the screen always says which. `navigator.geolocation` works on the itel R60+ test handset (confirmed on the device, 19 Sep 2026).

The key ends up in the page, so restrict it in Google Cloud Console to the **Maps Static API** and to the widget's HTTP referrer (e.g. `https://<user>.github.io/*`).

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
public/        icons, manifest, service worker, models/ (MobileCLIP image encoder + label table)
server/        FastAPI version of the recogniser: POST /v1/recognize
tools/vision/  rebuild the label table, shrink the ONNX weights
```

`app/lib/api.ts` exposes Promise functions named after the planned REST endpoints (`GET /v1/prices`, `POST /v1/deals`, …). Today they run in-process over seeded data and localStorage; pointing them at a Workers backend does not touch the screens.

## Scripts

`npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` (static export to `out/`; set `NEXT_PUBLIC_BASE_PATH=/<repo>` for GitHub Pages).

## Deploying and registering the widget

1. Push to `main`. The workflow tests, builds and publishes `out/` to the `gh-pages` branch; enable Pages with *Deploy from a branch → gh-pages*.
2. Sign in at <https://www.cloudphone.tech/my>, add a widget with the Pages URL, `public/icon-80.png` and the name, then open it in the Cloud Phone Simulator (Chrome only; uploads and the microphone do not work there).
3. To test on a handset, enable developer mode (Settings → About → press the left soft key 7 times) and add the device IMEI in the portal.

## Known limits

Demo data only; Kiswahili strings need native review; unit weights (gorogoro, debe, crate) need field calibration; recognition accuracy is measured on web photos, not on photos from the handset; whether CloudMosa's remote browser allows a 37 MB WASM model is unverified (the API route exists for that case); image upload, `#`/`*` key values and soft-key events still have to be confirmed on the itel test handset — the Cloud Phone Simulator cannot upload files at all.
