-- Mizani database (Cloudflare D1 / SQLite): accounts and buyer posts.
-- Apply with:  npx wrangler d1 execute mizani --file=./schema.sql   (add --remote for production)

-- One row per trader. The username is the primary key: it is the identity shown on the buyer
-- map, so it has to be unique, and SQLite gives us that for free without a second index.
CREATE TABLE IF NOT EXISTS users (
  -- lowercased by app/lib/auth.ts normalizeUsername() before it ever reaches SQL
  username   TEXT    PRIMARY KEY,
  -- NOT the password: a tagged PBKDF2-SHA256 digest, "p1$<rounds>$<hex>" (app/lib/auth.ts).
  -- The plain password never leaves the request handler.
  password   TEXT    NOT NULL,
  -- 16 random bytes, hex, unique per user, so two people with one password get two digests
  salt       TEXT    NOT NULL,
  created_at INTEGER NOT NULL  -- epoch ms
) STRICT;

-- Opaque bearer tokens. Kept in their own table so signing out, or expiring every session of one
-- account, is a delete and never touches the user row.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  username   TEXT    NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS sessions_username ON sessions(username);
CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

-- Buyer posts ("I want to buy"). One open post per account and crop: publishing again updates the
-- row. A buyer's intended price lives only here and never feeds the market-price statistics.
CREATE TABLE IF NOT EXISTS demands (
  id           TEXT    PRIMARY KEY,
  username     TEXT    NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  commodity_id TEXT    NOT NULL,
  -- a WFP market id from app/lib/catalog.ts: market-level only, never a street address
  market_id    TEXT    NOT NULL,
  kg           INTEGER NOT NULL,
  bid_c        INTEGER NOT NULL,  -- KES cents per kg
  -- public for three days, then the row is deleted (worker/src/index.ts sweep)
  phone        TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  UNIQUE (username, commodity_id)
) STRICT;

CREATE INDEX IF NOT EXISTS demands_commodity ON demands(commodity_id, expires_at);
CREATE INDEX IF NOT EXISTS demands_expires_at ON demands(expires_at);
