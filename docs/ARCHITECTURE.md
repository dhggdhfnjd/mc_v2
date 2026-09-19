# Architecture

The full design — meeting notes, Busia/J-PAL evidence, screen sketches, trust model, system diagram, data model and API — is the "Mizani 系統架構" page: <https://claude.ai/artifact/CVRT1T6Zo8eyZQR7YzyWdH> (private; ask the owner for access). This file is the short version that travels with the code.

## Menu tree (19 Sep 2026)

The app is a three-level menu. Every option is an icon plus its word on a numbered cell, so the
same move — look, press a digit — works on every screen.

```
L1 MAIN MENU
├─ 1 FOOD ──────▶ L2 food input ─┬─ Photo (lib/vision.ts)  ─┐
│                                └─ Text  (the crop grid)   ├─▶ L3 FOOD DETAIL
├─ 2 MAP ───────▶ L2 map view ───────── filter (food) ──────┤   map · now price · history
├─ 3 NOW PRICE ─▶ L2 price view ─────── filter (food) ──────┤   1/2/3 open the full view
├─ 4 HISTORY ───▶ L2 history view ───── filter (food) ──────┘
├─ 5 MY DEAL ───▶ L2 deal list ──▶ L3 deal detail
└─ 6 SETTING ───▶ L2 setting menu ──▶ L3 language / country
```

| Node | Screen |
| --- | --- |
| L1 main menu | `screens/Home.tsx` |
| L2 food input method | `screens/FoodInput.tsx` |
| L2 food by photo | `screens/Photo.tsx`, `lib/vision.ts` |
| L2 food by text | `screens/FoodPick.tsx` |
| L2 map view | `screens/DemandMap.tsx`, `lib/catalog.ts#routeCost` |
| L2 now price view | `screens/Price.tsx`, `lib/api.ts#getPrices` |
| L2 history price view | `screens/Trends.tsx#History` |
| L2 my deal list | `screens/Ledger.tsx` |
| L2 setting menu | `screens/Settings.tsx` |
| L3 food detail | `screens/FoodDetail.tsx`, `lib/api.ts#getFoodDetail` |
| L3 demand detail | `screens/DemandDetail.tsx` |
| L3 deal detail | `screens/DealDetail.tsx` |
| L3 language / country | `screens/LangCountry.tsx` |

The three filtered views remember the last food (`settings.foodId`), so L1 opens them straight
away; their left soft key re-enters the food input as the "filter (food)" step.

### What the restructure dropped

The earlier build was organised around the team decisions D1–D15 and had screens for bargaining
(D4), closing a deal (D5, D12, D13), reporting a price (D11), posting a demand (D7), the demand
list, the seasonal calendar (D10) and border FX. The menu tree above has no node for them, so
those screens were removed. `lib/money.ts` and `lib/trust.ts` still hold the fair-band, verdict,
counter-offer and crowd-screening maths, with their tests, so the flows can be restored on top of
them. `screens/Area.tsx` became the country half of the L3 language / country screen.

Nothing writes to the ledger any more, so `lib/seed.ts#seedDeals` supplies a week of demo deals
to keep that branch alive.

## Runtime picture

```
keypad phone ──keys──▶ CloudMosa cloud browser ──HTTPS JSON, one call per screen──▶ API
             ◀─draw cmds─   (this Next.js export runs here)                         (in-process today;
                                                                                    Workers + D1/KV/R2/Queues planned)
```

The slow, metered hop is phone ↔ data centre, so the app never animates, never polls, draws with text and SVG, and keeps all arithmetic local after a single fetch.

## Rules worth keeping

- Money is integer maths in `lib/money.ts`; no model or randomness may enter that path.
- Counter-offers use reciprocal concession: open just beyond the fair range, give ground only in proportion to how far the other side has come from a lowball toward the market reference, never cross the user's own cost floor or budget.
- Crowd prices are shown only with ≥ 3 independent reporters and always beside the dated official price.
- Locations are markets, never addresses: advertising who holds stock or cash invites robbery.
- Posting a demand needs a phone number (it sends someone on a real journey); reporting a price does not.
