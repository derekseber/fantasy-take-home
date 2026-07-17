# Roster Service API

Base URL: `http://localhost:8080` (override with client `EXPO_PUBLIC_API_URL`).

All request and response bodies use `application/json`.

## Types

### Player

```json
{ "id": "p1", "name": "Avery Stone", "position": "QB", "team": "BOS" }
```

### Roster

```json
{ "players": [{ "id": "p1", "name": "Avery Stone", "position": "QB", "team": "BOS" }] }
```

## Endpoints

### `GET /players?q=<name>`

Lists the **full seeded catalog**, optionally filtered by a case-insensitive name substring (`q`). Already-rostered players are **not** excluded.

**Success — 200**

```json
{ "players": [{ "id": "p1", "name": "Avery Stone", "position": "QB", "team": "BOS" }] }
```

Players are returned in stable name order.

### `POST /roster`

Adds a player to the roster and returns the complete roster.

**Request**

```json
{ "playerId": "p1" }
```

**Success — 201**

```json
{
  "roster": {
    "players": [{ "id": "p1", "name": "Avery Stone", "position": "QB", "team": "BOS" }]
  }
}
```

**Expected failures**

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_request` | Malformed JSON or missing `playerId` |
| 404 | `player_not_found` | Unknown player ID |
| 409 | `player_already_rostered` | Player already on roster |

## Error envelope

Every failure (including 429 and routing errors) uses:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests",
    "details": { "retryAfterSeconds": 2 }
  }
}
```

- `details` is optional and object-shaped.
- Stable codes: `invalid_request`, `player_not_found`, `player_already_rostered`, `not_found`, `method_not_allowed`, `rate_limited`, `internal_error`.

### Rate limiting — 429

When the token bucket is empty, responses include:

- Header: `Retry-After: <whole seconds ≥ 1>`
- Body: error envelope with `code: "rate_limited"` and `details.retryAfterSeconds`
- CORS: `Access-Control-Expose-Headers: Retry-After`

## Deliberate scope cuts

No authentication, no persistence across restarts, no pagination.
