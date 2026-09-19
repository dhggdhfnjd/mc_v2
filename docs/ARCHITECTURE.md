# Mizani architecture

Mizani reduces market-information inequality for small traders around the Kenya–Uganda border.
The primary job is to answer one question quickly: **what is this product worth?** Buyer posts are
a secondary discovery aid. Mizani is not a marketplace, chat app, deal book or bargaining tool.

## User flow

```text
HOME — products + photo in one paged 3×3 grid (D-pad + OK only)
  │
  ├─ Photo ── recognise ── confirm with Up/Down + OK ──┐
  └─ Product ───────────────────────────────────────────┤
                                                       ▼
PRODUCT HUB — 1 Now price · 2 Buyer map · 3 History · 4 I want to buy
  ├─ Now price: dated official price + sufficiently trusted crowd price
  ├─ Buyer map: market-level locations only
  │    ├─ Buyer detail: phone number; call outside Mizani
  │    └─ 0 From where? ─┬─ My location: GPS, 100 km map, OK uses the chosen market
  │                      └─ Choose city: the market list
  ├─ History: 30 / 90 / 365-day trend
  └─ I want to buy: edit market + quantity + price/kg + phone together → review
       └─ one active post per product; edit or close; expires after 3 days
```

Settings is reached by the home left soft key and contains only language and trading area.

## Interaction rules

- Home product selection never uses 1–9. The highlight, four arrow keys and OK are the complete
  interaction model. Photo is a normal first-class cell, not a separate choice screen.
- The four stable product actions keep 1–4 shortcuts as well as arrows and OK.
- The buyer-post editor keeps all related values on one page. Up/Down selects a field, digits edit
  it, Left/Right changes the market, and OK opens the separate review page.
- Every price says its source/date. All current values are demo values until the live ingest is
  connected.
- Buyer locations are market-level only. Exact addresses are never published.
- A buyer explicitly reviews that their phone will be public for three days. Sellers call that
  number directly; there is no in-app chat, negotiation or transaction workflow.

## Data boundaries

- Official and accepted crowd reports feed price statistics.
- A buyer's intended price is stored only in `demands`; it is **not** a completed transaction and
  must never be added to the market-price statistic.
- Money crossing module boundaries is integer KES cents per kg (`priceC` / `bidC`). Conversion to
  KES or UGX happens only for display and typed input.
- Local prototype data uses the `mz.v2.*` namespace. A future API can replace the Promise-returning
  functions in `app/lib/api.ts` without changing screens.

## Runtime constraints

```text
keypad phone ── keys ──▶ CloudMosa cloud browser ── HTTPS JSON ──▶ API
             ◀─ draw commands ────────────────────────────────────
```

The phone link is slow and metered, so screens do not animate or poll, maps are one optional
Google Static Maps image with everything that changes drawn over it as SVG (never panned tiles),
and a screen performs at most one read request. QVGA (240×320) and QQVGA (128×160) remain the
supported layouts.
