# Mizani API

Accounts and buyer posts over a **SQLite** database. It exists because the widget is a static
export: there is no server behind the page, an account has to be the same account on every
handset, and a buyer post has to reach every seller's handset.

The API runs in two places from **one** source file, `src/index.ts`:

| where | entry point | database | used for |
| --- | --- | --- | --- |
| the hackathon server | `server.ts` (Bun) | a SQLite file (`bun:sqlite`) | **what we deploy** |
| Cloudflare | `src/index.ts` (Worker) | D1 (serverless SQLite) | the original target; still works |

`src/index.ts` is written against the slice of the D1 API it needs (`prepare → bind →
first / all / run`). `server.ts` supplies exactly that slice over `bun:sqlite` and adds a plain
HTTP listener, so neither deployment needs its own copy of the logic, and `schema.sql` is shared.

## The database

One table per job (`schema.sql`):

| table | key | holds |
| --- | --- | --- |
| `users` | `username` **PRIMARY KEY** | `password` (a PBKDF2-SHA256 digest, never the password), `salt`, `created_at` |
| `sessions` | `token` | `username` → `users`, `created_at`, `expires_at` |
| `demands` | `id`, **UNIQUE** (`username`, `commodity_id`) | `market_id`, `kg`, `bid_c` (KES cents/kg), `phone`, `created_at`, `expires_at` |

A buyer has one open post per crop, so publishing again is an upsert on (`username`,
`commodity_id`) that keeps the id. Rows are **deleted** once they expire (at most three days), on
every list and publish, so a phone number does not outlive the promise made to the buyer. Posts
are validated by [`app/lib/demand.ts`](../app/lib/demand.ts), which the phone also runs before
sending. A buyer's price lives only in this table and never feeds the market-price statistics.

`username` is the primary key because it is also the public identity printed on the buyer map, so
uniqueness is a property of the data rather than something the application has to remember to
check. Registration inserts and lets SQLite reject a duplicate; that closes the race two phones
can otherwise win together.

Passwords are hashed by [`app/lib/auth.ts`](../app/lib/auth.ts) — PBKDF2-SHA256, 100 000 rounds,
16 random bytes of salt per user, stored as `p1$<rounds>$<hex>`. The API imports that module
directly, so the browser and the server can never drift into two different rules.

## Routes

| method | path | body / header | success | failure |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/auth/register` | `{username, password}` | `201 {username, token, expiresAt}` | `400 userInvalid` / `400 passShort` / `409 userTaken` |
| `POST` | `/v1/auth/login` | `{username, password}` | `200 {username, token, expiresAt}` | `401 wrongLogin` |
| `POST` | `/v1/auth/logout` | `Authorization: Bearer <token>` | `204` | — |
| `GET` | `/v1/auth/me` | `Authorization: Bearer <token>` | `200 {username}` | `401 needSignIn` |
| `GET` | `/v1/demands?c=<crop>` | — | `200 {demands:[…]}` open posts, newest first | — |
| `GET` | `/v1/demands/mine?c=<crop>` | `Authorization: Bearer <token>` | `200 {demand}` or `{demand:null}` | `401 needSignIn` |
| `POST` | `/v1/demands` | Bearer + `{commodityId, marketId, kg, bidC, days, phone}` | `200 {demand}` | `400 badPost` / `401 needSignIn` |
| `POST` | `/v1/demands/close` | Bearer + `{id}` | `204` (only your own post is touched) | `401 needSignIn` |
| `GET` | `/health` | — | `200 {ok:true}` | — |

Errors come back as `{"error": "<code>"}` where the code is one of the `AuthCode` names in
`app/lib/auth.ts`, which are also i18n keys — the phone translates them instead of printing
English prose to a Kiswahili screen.

## Run it locally

```bash
cd worker
npm install
bun run server.ts     # http://127.0.0.1:8787, creates ./mizani.db on first run
```

`server.ts` applies `schema.sql` itself (every statement is `CREATE … IF NOT EXISTS`), so there is
no separate migration step. Then point the widget at it:

```bash
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8787 npm run dev   # from the repository root
```

Without `NEXT_PUBLIC_API_BASE` the app keeps accounts and buyer posts in this handset's own
storage instead, so a demo runs with no backend at all (`app/lib/api.ts`). The labelled demo buyers
are shown in both modes.

## Deploy on the hackathon server

```bash
DB_PATH=/srv/mizani-api/data/mizani.db PORT=8787 bun run server.ts
```

Caddy terminates TLS, serves the static widget, and passes the API through on the same origin, so
the browser never makes a cross-origin request:

```caddyfile
handle_path /api/* {
    reverse_proxy 127.0.0.1:8787
}
```

Build the widget with `NEXT_PUBLIC_API_BASE` pointing at that path (the repository variable
`API_BASE` in CI). `ALLOWED_ORIGINS` defaults to `https://203-116-30-132.sslip.io` and only
matters if the widget is ever served from another origin.

Two things to remember on a fresh boot: the process is not yet a systemd service, so it has to be
started by hand, and the `iptables` rules that open 80/443 are not persistent either. The database
is a single file — copy it somewhere before and after the demo.

## Deploy on Cloudflare instead

```bash
npx wrangler d1 create mizani          # paste the printed database_id into wrangler.toml
npm run db:init:remote
npx wrangler deploy
```

Then add the widget's origin to `ALLOWED_ORIGINS` in `wrangler.toml` (a Worker is a different
origin from the widget, so CORS applies here) and set `NEXT_PUBLIC_API_BASE` to the deployed
Worker URL.

## Still to do

- Run the Bun process under systemd so it survives a reboot, and back the database file up.
- Rate-limit `/v1/auth/login` per IP and per username, and `POST /v1/demands` per account. Cloud
  Phone requests all arrive from CloudMosa's data-centre IPs, so the limiter has to key on
  `X-Forwarded-For`, not the connecting address.
