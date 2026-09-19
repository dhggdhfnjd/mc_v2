# Mizani architecture

Mizani reduces market-information inequality for small traders around the Kenya–Uganda border.
The primary job is to answer one question quickly: **what is this product worth?** Buyer posts are
a secondary discovery aid. Mizani is not a marketplace, chat app, deal book or bargaining tool.

## User flow

```text
SIGN IN — username + password, typed with the multi-tap alphabet
  └─ LSK REGISTER — username + password + repeat → account created, signed in
        (this is the whole app until there is a session; see "Accounts" below)

HOME — products + photo in one paged 3×3 grid (D-pad + OK only)
  │
  ├─ Photo ── recognise ── confirm with Up/Down + OK ──┐
  └─ Product ───────────────────────────────────────────┤
                                                       ▼
PRODUCT HUB — 1 Now price · 2 Buyer map · 3 History · 4 I want to buy
  ├─ Now price: dated official price + sufficiently trusted crowd price
  ├─ Buyer map: 50 km around you (* = whole corridor); market-level locations only
  │    ├─ Buyer detail: phone number; call outside Mizani
  │    └─ 0 From where? ─┬─ 1 My location: GPS, 100 km map, OK uses the chosen market
  │                      ├─ 2 Choose city: the market list
  │                      └─ 3 Coordinates: type latitude / longitude
  ├─ History: 30 / 90 / 365-day trend
  └─ I want to buy: edit market + quantity + price/kg + phone together → review
       └─ one active post per product; edit or close; expires after 3 days
```

Settings is reached by the home left soft key and contains language, coordinates and the account
(which name is signed in, and signing out).

Location is `settings.marketId` plus an optional `settings.fix` (`source: "gps" | "manual"`).
Prices, transport and net always use `marketId`; with a fix it is the market nearest the point.
The buyer map centres on the fix when there is one, otherwise on the market.

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

## Accounts

A buyer post is published under a name, and sellers decide whom to call partly by that name, so
the app has no anonymous mode: signed out, the whole widget is the login screen.

```text
phone ── username + password ──▶ POST /v1/auth/register | /v1/auth/login  (worker/)
      ◀─ {username, token, expiresAt} ─────────────────  D1: users, sessions
```

- `users.username` is the **primary key** of the table and the identity printed on the buyer map.
  Uniqueness is therefore a property of the data, not a check the application has to remember; a
  duplicate registration is rejected by SQLite, which also settles the race between two phones.
- Passwords are hashed by `app/lib/auth.ts` — PBKDF2-SHA256, 100 000 rounds, 16 bytes of salt per
  user — and the Worker imports that same module, so there is one KDF rather than two that can
  drift. The plain password exists only inside the call that hashes it.
- Errors cross the wire as the `AuthCode` names from `app/lib/auth.ts`, which are also i18n keys,
  so the API never sends English prose to a phone set to Kiswahili.
- Without `NEXT_PUBLIC_API_BASE` the same schema is kept in this handset's storage. That is the
  offline demo path, not the product: an account made that way exists on one phone.
- Signing in or out swaps the whole screen stack (`RouterProvider` is remounted with a different
  root), so the back key can never walk from Home into Login, and no screen of the previous
  account survives a sign-out.
- Text is typed with `app/core/textentry.ts`: Cloud Phone's `<input>` never delivers keydown, so
  the field is a div, digits carry letters as on any keypad, and `*` switches abc/ABC/123. The
  reducer is pure and timestamp-driven, so typing repaints once per key and never on its own.

## Data boundaries

- Official and accepted crowd reports feed price statistics.
- A buyer's intended price is stored only in `demands`; it is **not** a completed transaction and
  must never be added to the market-price statistic.
- Every buyer post carries the `username` of the account that wrote it. Posting without a session
  fails in `api.ts` rather than falling back to an anonymous name.
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
