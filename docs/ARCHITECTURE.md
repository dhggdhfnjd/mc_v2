# Architecture

The full design — meeting notes, Busia/J-PAL evidence, screen sketches, trust model, system diagram, data model and API — is the "Mizani 系統架構" page: <https://claude.ai/artifact/CVRT1T6Zo8eyZQR7YzyWdH> (private; ask the owner for access). This file is the short version that travels with the code.

## Team decisions (19 Sep 2026) → code

| # | Decision | Where |
| --- | --- | --- |
| D1 | First screen picks the product; favourites | `screens/Home.tsx` |
| D2 | Then pick your area | `screens/Area.tsx`, `core/settings.tsx` |
| D3 | Show the official per-kg price and the user-reported price | `screens/Price.tsx`, `lib/api.ts#getPrices` |
| D4 | Enter a quantity, get the amount | `screens/Calc.tsx`, `lib/money.ts` |
| D5 | Ask "did you close, at what price?"; the answer is a crowd data point | `screens/CloseDeal.tsx`, `lib/api.ts#postDeal` |
| D6 | No delivery, no logistics (rejected) | — |
| D7 | "Reverse Shopee": buyers post place + crop + quantity + price; sellers deliver | `screens/Demands.tsx`, `screens/Forms.tsx#PostDemand` |
| D8 | Demand as bubbles on a map; compare fare and price | `screens/DemandMap.tsx`, `lib/catalog.ts#routeCost` |
| D9 | History = trend | `screens/Trends.tsx#History` |
| D10 | Season, "like booking a flight" | `screens/Trends.tsx#Season` |
| D11 | Report: product preset, market, quality | `screens/Forms.tsx#Report` |
| D12 | Personal ledger as the incentive to report | `screens/Ledger.tsx` |
| D13 | Photo after a deal as evidence | `screens/CloseDeal.tsx` (weight ×1.5 in `lib/trust.ts`) |
| D14 | Government price is the anchor, crowd price secondary | `lib/money.ts#fairBand`, `lib/trust.ts#screenReport` |
| D15 | Reporter credibility without identity checks; confidence indicator | `lib/trust.ts` (`aggregate`, `confidenceBars`, `nextReputation`) |

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
