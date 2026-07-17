package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/fantasy/fantasy-take-home/task3/server/internal/api"
	"github.com/fantasy/fantasy-take-home/task3/server/internal/ratelimit"
	"github.com/fantasy/fantasy-take-home/task3/server/internal/store"
)

func main() {
	addr := flag.String("addr", envOr("ROSTER_ADDR", ":8080"), "listen address")
	capacity := flag.Float64("rate-capacity", envFloat("ROSTER_RATE_CAPACITY", 5), "token bucket capacity")
	refill := flag.Float64("rate-refill", envFloat("ROSTER_RATE_REFILL", 1), "tokens refilled per second")
	flag.Parse()

	mem := store.NewMemoryStore(store.DefaultSeed())
	handlers := &api.Handlers{Store: mem}
	mux := api.NewMux(handlers)
	bucket := ratelimit.NewTokenBucket(*capacity, *refill)

	// Composition: CORS → Logging → RateLimit → handlers → store
	var h http.Handler = mux
	h = api.RateLimit(bucket, h)
	h = api.Logging(h)
	h = api.CORS(h)

	log.Printf("roster service listening on %s (capacity=%.0f refill=%.1f/s)", *addr, *capacity, *refill)
	if err := http.ListenAndServe(*addr, h); err != nil {
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envFloat(key string, fallback float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return fallback
	}
	return f
}
