# Task 3 Architecture Plan — Rate-Limited Roster Service + Client

## Architecture and request path

```text
React Native screen → useRosterDemo → useApiClient → HTTP
                                                      ↓
request → Logging → RateLimit → Router/Handlers → Store interface → In-memory store
             ↑           ↑              ↓
         status/time   TokenBucket   JSON response/error
```

- Logging is the outer middleware so it records every response, including rate-limit rejections. It captures method, path, status, response bytes, and duration through a response-writer wrapper.
- Rate limiting is the next independent middleware. Handlers only decode/validate, call the store, and map results to the documented contract.
- A small CORS middleware (outermost, alongside logging) allows the Expo client origin and sets `Access-Control-Expose-Headers: Retry-After` so the browser/RN fetch layer can read the retry hint on 429 responses.
- Dependencies are assembled in `server/cmd/roster/main.go`; middleware, handlers, bucket, and store remain independently constructible and testable.

## Token bucket and `Retry-After`

- `TokenBucket` is concurrency-safe and owns capacity, current tokens, refill rate, and a clock/time input usable in deterministic tests.
- `Allow(now)` refills according to elapsed time, consumes one token when available, and returns whether the request may proceed.
- `RetryAfter(now)` reports the duration until the next whole token is available (`0` when one is already available).
- Middleware calls `Allow`; on rejection it sets `Retry-After` to the ceiling of `RetryAfter` in whole seconds (minimum `1`), returns HTTP 429, and writes the standard error envelope.
- Capacity/refill settings are configurable at startup. Demo defaults will be intentionally small enough to exercise 429 behavior, while tests use a fake clock.

## Draft API contract (`API.md`)

All request and response bodies use `application/json`.

`Player`:

```json
{ "id": "p1", "name": "Avery Stone", "position": "QB", "team": "BOS" }
```

### `GET /players?q=<name>`

- `q` is optional, trimmed, and matched case-insensitively as a name substring.
- Returns the full seeded catalog (filtered only by `q`) in stable name order. Already-rostered players are not excluded; `API.md` documents this explicitly.
- HTTP 200:

```json
{ "players": [{ "id": "p1", "name": "Avery Stone", "position": "QB", "team": "BOS" }] }
```

### `POST /roster`

- Request:

```json
{ "playerId": "p1" }
```

- Adds the player atomically and returns the complete roster.
- HTTP 201:

```json
{ "roster": { "players": [{ "id": "p1", "name": "Avery Stone", "position": "QB", "team": "BOS" }] } }
```

- Expected failures: 400 malformed/invalid request, 404 unknown player, and 409 player already rostered.

### Error envelope

Every failure, including router/method failures and 429, uses:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests",
    "details": { "retryAfterSeconds": 2 }
  }
}
```

- `details` is optional and JSON-object-shaped.
- Stable codes include `invalid_request`, `player_not_found`, `player_already_rostered`, `not_found`, `method_not_allowed`, `rate_limited`, and `internal_error`.
- A shared HTTP JSON writer owns envelope serialization and headers so handlers and middleware cannot drift.

## Store boundary

The handler-facing `RosterStore` interface exposes:

- `ListPlayers(ctx, nameQuery) ([]Player, error)` — full catalog filtered by name substring
- `AddPlayer(ctx, playerID) (Roster, error)`

The in-memory implementation protects player/roster state with a mutex, returns typed sentinel/domain errors for not-found and duplicate additions, and returns copies rather than mutable internal slices.

## Client design

- `client/src/api/types.ts` mirrors `API.md` exactly: `Player`, `Roster`, request/response DTOs, error envelope, and stable error-code union.
- Base URL comes from `EXPO_PUBLIC_API_URL` (documented in the README, including the Android emulator's `http://10.0.2.2:<port>` loopback alias); a sensible localhost default applies when unset.
- `useApiClient` owns all transport policy:
  - **Dedupe:** one in-flight promise per `METHOD + normalized URL/query + stable JSON body`; simultaneous identical calls share it, and the entry is removed on settlement.
  - **TTL cache (GET only):** successful GET responses are cached for 10 seconds and valid cached data is returned immediately. A successful roster mutation invalidates affected player-list keys. This is a pure response cache — distinct from optimistic UI, which is a presentation concern (see below).
  - **Retry:** the primary retry path is 429 + `Retry-After` — parse the header (delta-seconds, with HTTP-date support), enter `retrying`, wait that duration, and retry up to a small attempt bound. As a secondary, deliberately minor path, network errors and 5xx get one or two bounded retries with a short delay; other 4xx responses fail immediately with no retry.
  - **Cancellation:** every physical request uses an `AbortController`; unmount aborts active requests and clears retry timers. Aborts do not transition to user-visible errors.
  - **State:** exposes `idle | loading | retrying | success | error`, retry metadata, typed data, and normalized API errors.
- **Optimistic UI is a separate concern from the TTL cache** and lives in the demo layer: on add-to-roster, the row is immediately marked as rostered/adding; on terminal failure the mark is rolled back with an inline error; on success the state is reconciled with the server's returned roster.
- `useRosterDemo` is a thin domain/view-model hook over `useApiClient`: search, add-player, optimistic row state, and the demo burst action. It contains no dedupe, cache, retry, or cancellation logic — all transport policy stays in `useApiClient`, and the screen stays declarative.

## Demo screen UX

- Search input loads filtered available players and visibly labels the current state.
- Initial state is `idle`; fetch shows `loading`; 429 shows `retrying` with a countdown/attempt message; completion shows `success`; terminal failures show the API message and a retry action.
- Each player row has an Add button. The row changes immediately to an optimistic “Adding…” state, then settles to a “Rostered” badge on success (the full catalog stays visible) or rolls back with an inline error on failure.
- A clearly labeled “Trigger 429” control issues a small burst of distinct searches through `useRosterDemo`, avoiding request deduplication and reliably exhausting the low-capacity demo bucket.
- The current roster is rendered from the latest successful POST response so the complete flow is visible.

## Package layout

```text
server/
  cmd/roster/main.go
  internal/api/{handlers,errors,middleware}.go
  internal/ratelimit/token_bucket.go
  internal/store/{store,memory}.go
  internal/model/model.go
  go.mod
client/
  src/api/{types,useApiClient,cache,retry}.ts
  src/roster/useRosterDemo.ts
  src/screens/RosterDemoScreen.tsx
  App.tsx
  package.json
API.md
README.md
```

Tests live beside their units. The client will use the smallest Expo/React Native setup needed to run the demo.

## Test plan

- **Token bucket:** initial capacity, consumption, fractional refill, capacity cap, exact retry duration, zero retry when allowed, and concurrent access/race safety.
- **Middleware:** composition order, logging of handler and 429 responses, status/byte capture, allowed requests, standard 429 envelope, integer `Retry-After`, CORS headers including `Access-Control-Expose-Headers: Retry-After`, and independence via stub handlers/buckets.
- **Handlers/store:** search normalization/filtering, stable ordering, valid add, malformed JSON, missing ID, unknown player, duplicate add, method/not-found routing, consistent envelopes, atomic concurrent additions, and defensive copies.
- **Server verification:** `go test ./...` and `go test -race ./...`.
- **Client helpers (required):** deterministic dedupe keys, in-flight sharing/cleanup, TTL hit/expiry/invalidation, `Retry-After` parsing, bounded retry transitions (429 primary; single bounded 5xx/network fallback), terminal errors, and abort during fetch/wait.
- **`useApiClient` (required):** mocked-fetch hook tests covering all five states, 429 retry honoring `Retry-After`, and unmount cancellation.
- **Screen/demo (optional if time-constrained):** optimistic add/rollback behavior in `useRosterDemo`, plus a focused screen test for search, add transition, roster rendering, retry feedback, and the 429 trigger wiring.

## Delivery slices and commits

1. Commit this approved architecture plan.
2. Implement and verify the server, `API.md`, and server tests; commit as the server slice.
3. Implement and verify the typed client, demo screen, and client tests; commit as the client slice.

No commits are squashed. Implementation starts only after plan approval.

## Deliberate scope cuts

- No authentication or per-user identity; the demo limiter and roster are process-wide.
- No persistence; restarting resets seeded players and roster state.
- No pagination; the seeded player set is intentionally small.
- No distributed rate-limit coordination or production observability backend.

## Rejected alternatives

1. **Rate limiting or logging inside handlers:** duplicates cross-cutting behavior, allows endpoint drift, and prevents isolated middleware tests.
2. **A handler-aware bucket or middleware-owned token math:** couples HTTP to rate-limit policy; a standalone bucket with `Allow`/`RetryAfter` is reusable and deterministically testable.
3. **React Query or screen-owned fetch/retry state:** React Query would hide the requested hook mechanics, while screen-owned concerns would violate the declarative client boundary and make retry/cancellation behavior harder to test.
