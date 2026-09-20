# Mizani

Mizani is a Cloud Phone widget for keypad phones. It answers one question fast: **what is my crop
worth today?** It is built for smallholders and informal cross-border traders around the Busia
Kenya–Uganda border, who carry feature phones and pay for data by the screenful.

Prices are WFP's published Kenyan wholesale observations, bundled with the app and always shown
with their source and date. The sample buyer posts and exchange rates are still demo data.

- Architecture, technology and the reasoning behind each choice: [docs/TECH_OVERVIEW.md](docs/TECH_OVERVIEW.md)
- Screen flow and data boundaries: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- The account API: [worker/README.md](worker/README.md)

## Features

| | |
| --- | --- |
| **Today's price** | The latest WFP wholesale price per kg for a crop, with the market it came from and the date it was observed. `#` switches KSh / USh. |
| **Price history** | Monthly trend over 12, 24 or 60 months at the same market. |
| **Photo instead of typing** | Point the camera at the crop and the app names it, so nobody has to spell "dolichos" on a numeric keypad. 11 crops, top-3 accuracy 91%. |
| **Buyer map** | Open buyer posts, bubbled on their market. Zoom to one market or to where you are, then call the buyer directly — Mizani has no chat or bargaining. |
| **Post a demand** | Buyers publish market, quantity, price per kg and a phone number. One open post per crop; it expires after three days and can be edited or closed. |
| **Audio mode** | Speaks each crop's name as the highlight lands on it, for traders who read slowly or not at all. Off by default. |
| **Accounts** | A buyer post is signed, so posting needs an account. Names and passwords are typed with a multi-tap alphabet. |
| **English and Kiswahili** | Switched in Settings. Kiswahili is a first pass and still needs a native review. |
| **QVGA and QQVGA** | 240×320 and 128×160, no animation and no polling. |

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. A desktop browser shows a clickable phone frame; a viewport up to
330 px wide renders as the handset itself. `?bare=1` forces full screen, `?size=qq` forces QQVGA.

Accounts and shared buyer posts need the API in [`worker/`](worker/README.md):

```bash
cd worker && npm install && bun run server.ts            # http://127.0.0.1:8787
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8787 npm run dev   # in the repository root
```

Without `NEXT_PUBLIC_API_BASE` the app keeps accounts and posts in this handset's own storage, so a
demo runs with no backend at all — but the account then exists on that one phone only.

### Using it

1. **Sign in**, or register from the left soft key. Signed out, the widget is the login screen and
   nothing else.
2. **Home** is a paged 3×3 grid: the photo cell first, then every crop. Move with the arrow keys
   and confirm with OK. Digits do nothing here, on purpose.
3. **A crop opens its hub**: `1` today's price, `2` buyer map, `3` history, `4` I want to buy.
4. **The buyer map** opens on every WFP market in Kenya. `*` zooms to the selected market, `0`
   zooms to your GPS location, and pressing the same key again zooms back out. OK drops into the
   buyer rows, where another OK opens a buyer and the number to call; Up/Down there steps between
   the buyers at that market.
5. **Settings** is the left soft key on Home: language, coordinates, account and audio mode.

### Checks

```bash
npm run typecheck
npm test
npm run lint
npm run build      # static export to out/
```

## Keys

| Key | Action |
| --- | --- |
| `↑ ↓ ← →`, `OK` | move and confirm; the only way to pick a crop on Home |
| `1`–`4` | crop hub shortcuts; digits also type values inside forms |
| `2`–`9` | sign-in and register: multi-tap letters (press `2` twice for "b") |
| `*` | sign-in: switch abc / ABC / 123 · buyer map: zoom to the selected market |
| `0` | buyer map: zoom to your GPS location |
| `#` | price screen: switch KSh / USh · login screen: audio mode on or off |
| `Esc` / `Q` | left soft key |
| device back event / `F12` / `W` | right soft key — one screen back |

## Build-time settings

These are read when the app is **built**, so a change needs a rebuild. Everything prefixed
`NEXT_PUBLIC_` is compiled into the page: never put a secret there.

| Variable | What it does | Left unset |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE` | Where the account and buyer-post API lives (`/api` when Caddy proxies it on the same origin). | Accounts and posts stay on the handset |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Draws the buyer map on one dark Google Static Maps image. Restrict the key to the Maps Static API and the widget's referrer. | The hand-drawn SVG schematic is used; `?map=svg` forces it anyway |
| `NEXT_PUBLIC_VISION_BASE` | Moves photo recognition to the HTTP service in [`server/`](server/) instead of running the model in the page. | The model runs in the page |
| `NEXT_PUBLIC_BASE_PATH` | Sub-path the widget is served from, e.g. `/mc_v2`. CI sets it to the repository name. | Served from the domain root |

In CI these come from the repository variables `API_BASE` and `VISION_BASE` and the secret
`GOOGLE_MAPS_KEY`.
