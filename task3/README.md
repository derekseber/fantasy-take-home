# Task 3 — Rate-Limited Roster Service + Client

Go HTTP roster service with composable middleware (CORS → Logging → RateLimit → handlers → store) and an Expo/React Native demo client.

See [API.md](./API.md) for the HTTP contract (source of truth for client types).

## Server

```bash
cd task3/server
go run ./cmd/roster
# optional: -addr :8080 -rate-capacity 5 -rate-refill 1
```

Defaults intentionally use a small token bucket (capacity 5, refill 1/s) so the demo can trigger 429s.

```bash
cd task3/server
go test ./...
go test -race ./...
```

## Client (Expo / React Native)

```bash
cd task3/client
npm install
# iOS simulator / web:
EXPO_PUBLIC_API_URL=http://localhost:8080 npm start
# Android emulator (host loopback):
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080 npm start
```

`useApiClient` owns dedupe, GET TTL cache, 429/`Retry-After` retry (primary), bounded 5xx/network retry (secondary), and AbortController cancellation. Optimistic add/rollback lives in `useRosterDemo`. The screen stays declarative.

```bash
cd task3/client
npm test
```

## Deliberate scope cuts

No auth, no persistence, no pagination.
