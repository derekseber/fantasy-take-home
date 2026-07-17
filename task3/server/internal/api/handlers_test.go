package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/fantasy/fantasy-take-home/task3/server/internal/api"
	"github.com/fantasy/fantasy-take-home/task3/server/internal/ratelimit"
	"github.com/fantasy/fantasy-take-home/task3/server/internal/store"
)

func TestCORSExposesRetryAfter(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := api.CORS(inner)
	req := httptest.NewRequest(http.MethodGet, "/players", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if got := rr.Header().Get("Access-Control-Expose-Headers"); got != "Retry-After" {
		t.Fatalf("Expose-Headers = %q", got)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("Allow-Origin = %q", got)
	}
}

func TestCORSPreflight(t *testing.T) {
	h := api.CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("should not reach inner on OPTIONS")
	}))
	req := httptest.NewRequest(http.MethodOptions, "/players", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestRateLimitAllowsThen429(t *testing.T) {
	bucket := ratelimit.NewTokenBucket(1, 0.001) // essentially no refill in test window
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	h := api.RateLimit(bucket, inner)

	rr1 := httptest.NewRecorder()
	h.ServeHTTP(rr1, httptest.NewRequest(http.MethodGet, "/players", nil))
	if rr1.Code != http.StatusOK {
		t.Fatalf("first status = %d", rr1.Code)
	}

	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2, httptest.NewRequest(http.MethodGet, "/players", nil))
	if rr2.Code != http.StatusTooManyRequests {
		t.Fatalf("second status = %d", rr2.Code)
	}
	retry := rr2.Header().Get("Retry-After")
	if retry == "" {
		t.Fatal("missing Retry-After")
	}
	secs, err := strconv.Atoi(retry)
	if err != nil || secs < 1 {
		t.Fatalf("Retry-After = %q", retry)
	}

	var body api.ErrorBody
	if err := json.NewDecoder(rr2.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Error.Code != "rate_limited" {
		t.Fatalf("code = %q", body.Error.Code)
	}
	if body.Error.Details["retryAfterSeconds"] == nil {
		t.Fatal("expected retryAfterSeconds in details")
	}
}

func TestLoggingDoesNotBreakHandler(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"x":1}`))
	})
	h := api.Logging(inner)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/roster", nil))
	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestCompositionOrderCORSLoggingRateLimit(t *testing.T) {
	bucket := ratelimit.NewTokenBucket(1, 100)
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	var h http.Handler = inner
	h = api.RateLimit(bucket, h)
	h = api.Logging(h)
	h = api.CORS(h)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/players", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	if rr.Header().Get("Access-Control-Expose-Headers") != "Retry-After" {
		t.Fatal("CORS headers missing through composition")
	}
}

func TestGetPlayersAndSearch(t *testing.T) {
	h := api.NewMux(&api.Handlers{Store: store.NewMemoryStore(store.DefaultSeed())})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/players", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	var resp map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	players := resp["players"].([]any)
	if len(players) != 8 {
		t.Fatalf("len = %d", len(players))
	}

	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2, httptest.NewRequest(http.MethodGet, "/players?q=avery", nil))
	if err := json.NewDecoder(rr2.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	players = resp["players"].([]any)
	if len(players) != 1 {
		t.Fatalf("search len = %d", len(players))
	}
}

func TestPostRosterSuccessAndErrors(t *testing.T) {
	h := api.NewMux(&api.Handlers{Store: store.NewMemoryStore(store.DefaultSeed())})

	post := func(body string) *httptest.ResponseRecorder {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/roster", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		h.ServeHTTP(rr, req)
		return rr
	}

	rr := post(`{"playerId":"p1"}`)
	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d body=%s", rr.Code, rr.Body.String())
	}

	rr = post(`{"playerId":"p1"}`)
	assertError(t, rr, http.StatusConflict, "player_already_rostered")

	rr = post(`{"playerId":"missing"}`)
	assertError(t, rr, http.StatusNotFound, "player_not_found")

	rr = post(`{`)
	assertError(t, rr, http.StatusBadRequest, "invalid_request")

	rr = post(`{"playerId":""}`)
	assertError(t, rr, http.StatusBadRequest, "invalid_request")
}

func TestMethodNotAllowedAndNotFound(t *testing.T) {
	h := api.NewMux(&api.Handlers{Store: store.NewMemoryStore(store.DefaultSeed())})

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/players", nil))
	assertError(t, rr, http.StatusMethodNotAllowed, "method_not_allowed")

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/nope", nil))
	assertError(t, rr, http.StatusNotFound, "not_found")
}

func assertError(t *testing.T, rr *httptest.ResponseRecorder, status int, code string) {
	t.Helper()
	if rr.Code != status {
		t.Fatalf("status = %d want %d body=%s", rr.Code, status, rr.Body.String())
	}
	var body api.ErrorBody
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Error.Code != code {
		t.Fatalf("code = %q want %q", body.Error.Code, code)
	}
}
