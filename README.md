# Fantasy Take-Home

## Task 3 — Rate-Limited Roster Service + Client

See [API.md](./API.md) for the HTTP contract.

### Server

```bash
cd server
go run ./cmd/roster
# optional: -addr :8080 -rate-capacity 5 -rate-refill 1
```

Defaults intentionally use a small token bucket (capacity 5, refill 1/s) so the demo can trigger 429s.

```bash
cd server
go test ./...
```

Composition: `CORS → Logging → RateLimit → handlers → store`.

### Client (Expo / React Native)

```bash
cd client
npm install
# iOS simulator / web:
EXPO_PUBLIC_API_URL=http://localhost:8080 npm start
# Android emulator (host loopback):
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080 npm start
```

`useApiClient` owns dedupe, GET TTL cache, 429/`Retry-After` retry, and AbortController cancellation. The demo screen stays declarative.

### Deliberate scope cuts

No auth, no persistence, no pagination.
