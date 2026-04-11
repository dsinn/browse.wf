# ADR 001: Profile Request Rate Limiting via Supabase

**Date:** 2026-03-14

## Context

The `/profile` page fetches Warframe player profile data via a two-hop proxy
(browse.wf → Cloudflare Worker front proxy → private proxy → Warframe API). The front proxy URL
and parameters are visible in browser dev tools, making it possible for an abusive user to issue
many `/profile` requests with arbitrary `platform` and `playerId` values, exhausting any rate
limits imposed by the Warframe API on our private proxy's IP.

Previously (before commit `296aa61`), users downloaded profile JSON themselves by navigating
directly to a Warframe API URL — no server-side rate limit risk. Commit `296aa61` replaced this
with an auto-fetch via the proxy, creating the abuse surface.

## Decision

Enforce the following at the front proxy (Cloudflare Worker) level:

1. `/profile` requests require a valid Supabase JWT (`Authorization: Bearer`) — only Discord-authenticated users can trigger upstream fetches.
2. A global rate limit of 10 upstream profile fetches per hour across all users is enforced to protect the private proxy.
3. Each Discord user is rate-limited to one upstream profile fetch per 23 hours, tracked in the Supabase database.
4. The number of lifetime upstream fetches per user is recorded for monitoring.
5. Users who are not logged in, or who have exhausted their rate limit, fall back to the manual download-and-upload flow that existed before `296aa61`.

## Rate Limit State Storage

The database stores the exact time when the next upstream fetch is permitted for each user.
The per-user cooldown (23 hours) lives exclusively in `try_profile_request`; the global hourly
threshold (10 requests) and window (1 hour) live exclusively in `is_global_profile_rate_limited`.

**Alternatives considered:**

- `last_requested_at` + client-side arithmetic: rejected because it leaks the cooldown duration to
  the browser and requires both client and server to agree on the value.
- Redis TTL: rejected — no Redis infrastructure; Supabase Postgres is already in use.

## Atomic Rate Limit Check

Concurrent requests for the same user are serialized at the database level before the rate limit
check and update. This prevents a race condition where two simultaneous requests both pass the
timestamp check before either updates the row.

**Alternatives considered:**

- Optimistic locking alone: insufficient for the new-row race (can't lock a non-existent row).
- `INSERT ... ON CONFLICT DO UPDATE`: avoids the race for new rows but is awkward combined with the
  conditional update for existing rows.
- Serializable isolation: would work but requires application-level retry handling.

## Client-Side Rate Limit Pre-Check

After a successful proxy fetch, the Worker includes the next-available timestamp in the response
body. The browser caches this timestamp locally. On subsequent page loads, if the cached timestamp
is in the future, the page shows the manual flow with a countdown — avoiding a round-trip to the
proxy.

Because the cached timestamp syncs to the cloud via the storage-sync service, a user cannot bypass
the rate limit by clearing local storage on one device and re-fetching on another. The server-side
check is the authoritative gate; the client-side check is an optimization that also improves UX.

## Response Shape: Body Wrapper vs. Header

The next-available timestamp is embedded in the JSON response body (not a custom header).

**Rationale:**
- Body-embedded metadata is the 2026 REST standard; custom headers for business logic have fallen
  out of favor (harder to document, type, and test; may be stripped by intermediaries).
- HTTP `Retry-After` is conventionally used on 429 responses, not 200 success responses.
- Profile JSON is small (tens of KB); re-serializing to add a wrapper field has negligible cost.

## Auth State Detection in profile.ts

`profile.ts` determines which flow to show (auto-fetch vs. manual) by reusing the existing cloud
sync infrastructure for auth state — no additional auth globals are needed. The fallback-to-manual
on sync error is intentional: if the database is unreachable, the Worker's rate limit check would
also fail, so the auto-fetch flow would not succeed anyway.

## Consequences

- Users must be logged in with Discord to use the auto-fetch flow. ✓ (rate limit protection)
- Each Discord account is limited to one upstream profile fetch per 23 hours. ✓
- A global cap of 10 requests per hour protects the private proxy's IP reputation. ✓
- Non-authenticated users retain full functionality via the manual download/upload flow. ✓
- Both rate limit thresholds are configurable by changing constants in their respective Postgres functions. ✓
- Two additional Cloudflare Worker secrets are required (`DATABASE_URL`, `DATABASE_SERVICE_ROLE_KEY`). ✗ (operational overhead, but manageable)
- The front proxy makes three additional network calls per allowed `/profile` request (auth check + global RPC + per-user RPC). ✗ (latency cost; acceptable given the infrequency of profile fetches)
