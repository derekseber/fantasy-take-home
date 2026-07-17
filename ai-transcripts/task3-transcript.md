# Task 3 Conversation Transcript — Rate-Limited Roster Service + Client

Record of the AI-assisted session for Task 3 (plan → approval → implementation → commit).

---

## Message 1 — User: Task brief + plan request

> Task 3: Full-Stack — Rate-Limited Roster Service + Client
>
> Build a small Go HTTP service (a fantasy roster service) and a React Native screen that consumes it, demonstrating API contract design and proper separation of cross-cutting concerns across the client/server boundary.
>
> **Go Side: Roster Service**
> - Two endpoints: `GET /players` (list available players, with a simple name-search query parameter) and `POST /roster` (add a player to the roster). In-memory storage is fine.
> - Rate limiting (token bucket) and request/response logging implemented as composable middleware layers — each independently testable, not inlined in handlers
> - A consistent JSON error shape across all endpoints, including 429 responses with a `Retry-After` header
> - Document the API contract in the README or a short API.md
>
> **React Native Side**
> - Custom `useApiClient` hook consuming the service, with: request deduplication, optimistic cache with TTL, automatic retry with UI state feedback (honoring Retry-After on 429), and proper cancellation on component unmount
> - Client types mirror the documented API contract
> - Demo screen showing the player list and add-to-roster flow with visible state transitions
>
> **Mandatory constraints (insight):**
> 1. Server composition: Logging → RateLimit → handlers → store; handlers stay thin.
> 2. Token bucket is its own type (`Allow` / `RetryAfter`), independently unit-tested; middleware only adapts it to HTTP + 429 + `Retry-After`.
> 3. Consistent error envelope for all failures including 429: `{ "error": { "code", "message", "details?" } }`.
> 4. Store behind an interface; in-memory impl is enough.
> 5. Client: `useApiClient` owns cross-cutting concerns (dedupe, TTL cache, 429 retry using Retry-After, AbortController on unmount). Screens stay declarative.
> 6. Client TypeScript types mirror API.md 1:1 — contract is the source of truth.
> 7. Demo must make states visible: `idle | loading | retrying | success | error` (and easy way to trigger 429).
> 8. Process: plan → approval → implement in slices (server first, then client) → commit after plan and after each slice; do not squash.
> 9. Scope cuts if needed: no auth, no persistence, no pagination — document deliberate cuts in the plan.
>
> Instructions (message 1 only): do NOT write implementation code yet. Write a short architecture plan (middleware chain diagram, token bucket behavior + Retry-After, error envelope, endpoint shapes for API.md, store interface, useApiClient responsibilities, demo screen state UX, package layout, test plan, 2–3 rejected alternatives). Save under `ai-transcripts/` (e.g. `task3-plan.md`), then STOP and wait for approval.

### Assistant

Wrote the architecture plan to `ai-transcripts/task3-plan.md` covering:

- Middleware chain: `request → Logging → RateLimit → Router/Handlers → Store interface → In-memory store`
- Token bucket with `Allow(now)` / `RetryAfter(now)`, ceiling of `RetryAfter` in whole seconds (min 1) for the header
- Error envelope `{ "error": { "code", "message", "details?" } }` with stable codes
- Draft API contract for `GET /players?q=` and `POST /roster` (200/201, 400/404/409/429)
- `RosterStore` interface with in-memory implementation
- `useApiClient` responsibilities: dedupe key, 10s TTL cache, retry loop, AbortController cancellation, five UI states
- Demo screen UX with visible state transitions and a "Trigger 429" control
- Package layout (`server/` + `client/`), test plan, delivery slices/commits, scope cuts
- Rejected alternatives: rate limit inlined in handlers; middleware-owned token math; React Query / screen-owned fetch state

Stopped and waited for approval. No code written.

---

## Message 2 — User: Approval with amendments

> Approve the plan with these changes before implementation:
>
> 1. `GET /players` returns the full seeded catalog filtered by optional `q` (name substring). Do not filter out already-rostered players unless API.md explicitly documents "available only" — prefer full catalog for simplicity.
> 2. Clarify in the plan: TTL cache (GET) vs optimistic UI (add/rollback) as two concerns inside useApiClient / demo.
> 3. Primary retry path is 429 + Retry-After; any 5xx/network retry is secondary and bounded — don't over-emphasize it.
> 4. Add CORS + `Expose-Headers: Retry-After`, and client base URL via `EXPO_PUBLIC_API_URL` (note Android emulator 10.0.2.2).
> 5. `useRosterDemo` stays thin; all transport policy (dedupe/cache/retry/cancel) remains in `useApiClient`.
> 6. If time-constrained, client screen tests are optional; helpers + useApiClient tests are required.
>
> Update the plan doc. Do NOT write application code yet.

### Assistant

Updated `ai-transcripts/task3-plan.md` with all six amendments:

1. Full catalog semantics for `GET /players` (store method renamed `ListPlayers`; demo rows settle to a "Rostered" badge instead of disappearing).
2. TTL cache documented as a pure GET response cache in `useApiClient`; optimistic UI called out as a separate presentation concern in the demo layer.
3. 429 + `Retry-After` stated as the primary retry path; 5xx/network retry downgraded to a bounded secondary path; other 4xx fail immediately.
4. CORS middleware with `Access-Control-Expose-Headers: Retry-After` added to the chain; base URL via `EXPO_PUBLIC_API_URL` with the `10.0.2.2` Android emulator note.
5. `useRosterDemo` explicitly contains no dedupe/cache/retry/cancellation logic.
6. Client helper + `useApiClient` tests marked required; screen/demo tests marked optional.

No application code written.

---

## Message 3 — User: Implement

> write the main code for this task3 based on the plan. Write it in `task3/`.

### Assistant

Implemented Task 3 under `task3/` per the approved plan.

**Server (`task3/server`, Go, module `github.com/fantasy/fantasy-take-home/task3/server`):**

- `internal/model/model.go` — `Player`, `Roster`, request/response DTOs
- `internal/store/store.go` — `RosterStore` interface + `ErrPlayerNotFound` / `ErrPlayerAlreadyRostered`
- `internal/store/memory.go` — mutex-guarded in-memory store, seeded 8-player catalog, full-catalog `ListPlayers` with case-insensitive substring filter and stable name order, atomic `AddPlayer` with defensive copies
- `internal/ratelimit/token_bucket.go` — concurrency-safe `TokenBucket` with `Allow(now)` / `RetryAfter(now)` and fractional refill
- `internal/api/errors.go` — shared `WriteJSON` / `WriteError` envelope writer
- `internal/api/middleware.go` — `CORS` (with `Access-Control-Expose-Headers: Retry-After`), `Logging` (status/bytes/duration), `RateLimit` (429 + `Retry-After` header + envelope with `retryAfterSeconds`)
- `internal/api/handlers.go` — thin handlers for `GET /players` and `POST /roster` (400/404/409 mapping)
- `cmd/roster/main.go` — composition `CORS → Logging → RateLimit → mux`, flags/env for addr and bucket capacity/refill (defaults capacity 5, refill 1/s to make 429s easy)
- Tests: token bucket (consumption, fractional refill, capacity cap, retry duration, concurrency), middleware (CORS headers, preflight, allow-then-429, envelope + integer Retry-After, logging pass-through, composition order), handlers (search, success/error paths, method/not-found routing), store (filter/order, no roster exclusion, duplicate/not-found, defensive copy, concurrent adds)
- `go test ./...` — all green

**Client (`task3/client`, Expo / React Native + TypeScript):**

- `src/api/types.ts` — types mirroring `task3/API.md` 1:1, plus `RequestStatus` union
- `src/api/cache.ts` — `TtlCache` with prefix invalidation
- `src/api/retry.ts` — `parseRetryAfter` (delta-seconds + HTTP-date), capped secondary backoff, abortable `sleep`
- `src/api/useApiClient.ts` — transport hook: dedupe via stable key (method + path + stable-stringified body), 10s GET TTL cache with `GET /players` invalidation after roster POST, primary 429/`Retry-After` retry loop (max 3), bounded secondary retry for network/5xx (max 2), AbortController-per-request with abort on unmount, exposes `status/data/error/retryAttempt/retryAfterSeconds`
- `src/roster/useRosterDemo.ts` — thin view-model: search, optimistic per-row add/rollback state, roster from last POST, `trigger429` burst of distinct queries (bypasses dedupe/cache)
- `src/screens/RosterDemoScreen.tsx` — declarative demo screen: state label (idle/loading/retrying with attempt+wait/success/error), search, Trigger 429 + Reload buttons, player rows with Add → Adding… → Rostered/Retry transitions, roster section
- Config: `App.tsx`, `index.ts`, `app.json`, `package.json`, `tsconfig.json`, `jest.config.js` (jest-expo), `.gitignore`; base URL from `EXPO_PUBLIC_API_URL` with localhost default
- Tests (Jest + @testing-library/react-native): cache TTL/expiry/prefix invalidation, Retry-After parsing, backoff cap, abortable sleep, dedupe key stability, GET caching, in-flight dedupe, 429 retry honoring Retry-After, immediate 4xx failure, unmount abort, cache invalidation after POST — **19 tests, all passing**

**Docs:** `task3/API.md` (contract: types, endpoints, error envelope, 429 semantics, scope cuts) and `task3/README.md` (run instructions for server and client, including `EXPO_PUBLIC_API_URL` and Android `10.0.2.2` note).

---

## Message 4 — Incident: accidental root file deletion (recovered)

Root-level tracked files (`API.md`, `README.md`, `server/`, `go.mod`, `pipeline/`) were briefly deleted during cleanup and restored with `git restore`. `task3/` was unaffected.

---

## Message 5 — User

> dont commit yet

### Assistant

Acknowledged; nothing committed.

---

## Message 6 — User

> commit this task3 and name it like this pattern (Add Task 1 pluggable data processing pipeline)

### Assistant

Committed `task3/` as `667fc59` — **"Add Task 3 rate-limited roster service and client"** (37 files). Root `API.md` / `README.md` duplicates left untracked/uncommitted.

---

## Message 7 — User

> restore this conversation in @ai-transcripts

### Assistant

Saved this transcript as `ai-transcripts/task3-transcript.md`.
