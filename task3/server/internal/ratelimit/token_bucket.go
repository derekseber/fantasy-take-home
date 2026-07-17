package ratelimit

import (
	"sync"
	"time"
)

// TokenBucket is a concurrency-safe token bucket rate limiter.
type TokenBucket struct {
	mu         sync.Mutex
	capacity   float64
	tokens     float64
	refillRate float64 // tokens per second
	last       time.Time
}

// NewTokenBucket creates a full bucket with the given capacity and refill rate.
// The clock starts on the first Allow/RetryAfter call so tests can drive time.
func NewTokenBucket(capacity float64, refillPerSecond float64) *TokenBucket {
	if capacity < 1 {
		capacity = 1
	}
	if refillPerSecond <= 0 {
		refillPerSecond = 1
	}
	return &TokenBucket{
		capacity:   capacity,
		tokens:     capacity,
		refillRate: refillPerSecond,
	}
}

// Allow refills based on elapsed time, consumes one token when available, and
// returns whether the request may proceed.
func (b *TokenBucket) Allow(now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.refill(now)
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// RetryAfter reports how long until the next whole token is available.
// Returns 0 when a token is already available.
func (b *TokenBucket) RetryAfter(now time.Time) time.Duration {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.refill(now)
	if b.tokens >= 1 {
		return 0
	}
	needed := 1 - b.tokens
	seconds := needed / b.refillRate
	return time.Duration(seconds * float64(time.Second))
}

func (b *TokenBucket) refill(now time.Time) {
	if b.last.IsZero() {
		b.last = now
		return
	}
	if now.Before(b.last) {
		return
	}
	elapsed := now.Sub(b.last).Seconds()
	b.tokens += elapsed * b.refillRate
	if b.tokens > b.capacity {
		b.tokens = b.capacity
	}
	b.last = now
}
