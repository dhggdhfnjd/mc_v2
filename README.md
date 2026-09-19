# Mizani

Mizani is a keypad-phone product for reducing agricultural market-information inequality around
the Busia Kenya–Uganda border. Its primary job is fast, understandable price lookup. Buyer posts
are secondary: sellers see a public phone number and make contact outside Mizani.

> Prototype: all prices, exchange rates and buyer records are deterministic demo data, not live
> market information.

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Desktop shows a clickable phone frame; viewports up to 330 px use the
handset layout. `?bare=1` forces full screen and `?size=qq` forces QQVGA.

## Current flow

1. Home shows Photo and all products in the same paged 3×3 grid.
2. Choose a product with the four arrow keys and OK. Digits intentionally do nothing here.
3. The product hub offers four stable actions:
   - `1` Now price
   - `2` Buyer map
   - `3` Price history
   - `4` I want to buy
4. A buyer edits market, quantity, price per kg and phone together, then opens a separate review
   page. The post expires after three days and can be edited or closed.
5. A seller opens a market bubble, cycles through buyers with Up/Down, and calls the displayed
   number directly. Mizani has no chat, negotiation or transaction workflow.
6. The buyer map opens on **50 km around your location** and only buyers inside that circle get
   bubbles; `* +N > 50 km` counts the rest and `*` toggles the whole corridor.
7. Your location can be set three ways, all from the buyer map's `0` "From where?":
   **My location** (`navigator.geolocation`, shown as a 100 km map; OK uses the selected market),
   **Choose city** from the market list, or **Coordinates** typed as latitude/longitude (`*` is the
   decimal point, `#` the minus sign). Settings → Coordinates opens the same editor. Prices,
   transport and net are counted from the market nearest your location; the map centres on the
   exact point.

### Map basemap and location

The buyer map draws its bubbles on a hand-drawn SVG schematic by default. Build with
`NEXT_PUBLIC_GOOGLE_MAPS_KEY=<key>` (CI reads the `GOOGLE_MAPS_KEY` repository secret) and they sit
on one dark, label-free Google Static Maps image instead; `app/lib/staticmap.ts` projects markets
with Web Mercator and pushes overlapping bubbles apart. The image never changes while you move
between bubbles, so only the SVG overlay redraws. If it fails to load the schematic returns;
`?map=svg` forces it. The key ends up in the page: restrict it to the Maps Static API and the
widget's HTTP referrer.

`navigator.geolocation` works on the itel R60+ test handset (confirmed on the device,
19 Sep 2026). `?at=lat,lon` pins a location for demos; if location is denied or times out, the
chosen city is used and the screen says so.

Settings is the home left soft key and contains only Language and Coordinates. On price/history/map
screens, the left soft key returns directly to Products.

## Important product rules

- Official prices are always dated; crowd prices appear only when there is sufficient evidence.
- Buyer-post prices never enter the market-price statistic because an intention to buy is not a
  completed market transaction.
- Buyer locations are market-level, never exact addresses.
- The buyer reviews a clear warning that their phone number is public for three days.
- QVGA 240×320 and QQVGA 128×160 are supported; there are no animations or polling.
- `navigator.hasFeature()` gates device capabilities such as direct `tel:` launching.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current flow and data boundaries.
`docs/USER_MANUAL.md`, `docs/HANDOVER.md`, and `docs/mizani-architecture.html` describe an older
prototype and are retained only as research history until their screenshots are regenerated.

## Keys

| Key | Action |
| --- | --- |
| `↑ ↓ ← →`, `Enter` | move and confirm; the only product-selection method on Home |
| `1`–`4` | product-hub shortcut; digits type values inside forms |
| `0` | buyer map: set your location (GPS, city or coordinates) |
| `*` | buyer map: 50 km view ↔ whole corridor |
| `Esc` / `Q` | left soft key |
| `F12` / `W` / device back event | right soft key or back |
| `#` | switch KSh / USh on the current-price screen |

## Quality checks

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Project layout

```text
app/screens/     one component per active screen
app/core/        keypad, navigation, settings, features, cache and translations
app/lib/         catalog, demo data, prices, buyer posts, trust and vision
app/components/  shared small-screen UI and desktop phone frame
public/          icons, PWA assets and recognition model
server/          optional FastAPI image-recognition service
```
