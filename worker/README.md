# Mizani account API

A Cloudflare Worker over a **D1** database (serverless SQLite). It exists because the widget is a
static export on GitHub Pages: there is no server in front of it, and an account has to be the
same account on every handset.

## The database

One table per job (`schema.sql`):

| table | key | holds |
| --- | --- | --- |
| `users` | `username` **PRIMARY KEY** | `password` (a PBKDF2-SHA256 digest, never the password), `salt`, `created_at` |
| `sessions` | `token` | `username` → `users`, `created_at`, `expires_at` |

`username` is the primary key because it is also the public identity printed on the buyer map, so
uniqueness is a property of the data rather than something the application has to remember to
check. Registration inserts and lets SQLite reject a duplicate; that closes the race two phones
can otherwise win together.

Passwords are hashed by [`app/lib/auth.ts`](../app/lib/auth.ts) — PBKDF2-SHA256, 100 000 rounds,
16 random bytes of salt per user, stored as `p1$<rounds>$<hex>`. The Worker imports that module
directly, so the browser and the server can never drift into two different rules.

## Routes

| method | path | body / header | success | failure |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/auth/register` | `{username, password}` | `201 {username, token, expiresAt}` | `400 userInvalid` / `400 passShort` / `409 userTaken` |
| `POST` | `/v1/auth/login` | `{username, password}` | `200 {username, token, expiresAt}` | `401 wrongLogin` |
| `POST` | `/v1/auth/logout` | `Authorization: Bearer <token>` | `204` | — |
| `GET` | `/v1/auth/me` | `Authorization: Bearer <token>` | `200 {username}` | `401 needSignIn` |
| `GET` | `/health` | — | `200 {ok:true}` | — |

Errors come back as `{"error": "<code>"}` where the code is one of the `AuthCode` names in
`app/lib/auth.ts`, which are also i18n keys — the phone translates them instead of printing
English prose to a Kiswahili screen.

## Run it locally

```bash
cd worker
npm install
npm run db:init      # creates the tables in the local D1 file
npm run dev          # http://127.0.0.1:8787
```

Then point the widget at it:

```bash
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8787 npm run dev   # from the repository root
```

Without `NEXT_PUBLIC_API_BASE` the app keeps accounts in this handset's own storage instead, so a
demo runs with no backend at all (`app/lib/api.ts`, `localMode`).

## Deploy

```bash
npx wrangler d1 create mizani          # paste the printed database_id into wrangler.toml
npm run db:init:remote
npx wrangler deploy
```

Add the widget's origin to `ALLOWED_ORIGINS` in `wrangler.toml` (the GitHub Pages URL), and set
`NEXT_PUBLIC_API_BASE` to the deployed Worker URL in the Pages build.

## Still to do

- Rate-limit `/v1/auth/login` per IP and per username; D1 plus a counter table, or Workers KV.
- Move buyer posts (`demands`) into D1 as well, with `username` a foreign key into `users`.
