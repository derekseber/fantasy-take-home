package ratelimit_test

import (
	"sync"
	"testing"
	"time"

	"github.com/fantasy/fantasy-take-home/task3/server/internal/ratelimit"
)

func TestAllowConsumesTokens(t *testing.T) {
	b := ratelimit.NewTokenBucket(2, 1)
	now := time.Unix(1000, 0)
	if !b.Allow(now) {
		t.Fatal("expected first allow")
	}
	if !b.Allow(now) {
		t.Fatal("expected second allow")
	}
	if b.Allow(now) {
		t.Fatal("expected deny when empty")
	}
}

func TestRetryAfterWhenEmpty(t *testing.T) {
	b := ratelimit.NewTokenBucket(1, 2) // 2 tokens/sec → 0.5s per token
	now := time.Unix(1000, 0)
	if !b.Allow(now) {
		t.Fatal("expected allow")
	}
	retry := b.RetryAfter(now)
	if retry <= 0 {
		t.Fatalf("expected positive retry, got %v", retry)
	}
	// Need ~0.5s for one token at 2/s
	if retry < 400*time.Millisecond || retry > 600*time.Millisecond {
		t.Fatalf("unexpected retry duration: %v", retry)
	}
}

func TestRetryAfterZeroWhenAllowed(t *testing.T) {
	b := ratelimit.NewTokenBucket(1, 1)
	now := time.Unix(1000, 0)
	if got := b.RetryAfter(now); got != 0 {
		t.Fatalf("expected 0, got %v", got)
	}
}

func TestRefillAndCapacityCap(t *testing.T) {
	b := ratelimit.NewTokenBucket(2, 1)
	now := time.Unix(1000, 0)
	_ = b.Allow(now)
	_ = b.Allow(now)
	// After 5 seconds should refill to capacity (2), not more
	later := now.Add(5 * time.Second)
	if !b.Allow(later) {
		t.Fatal("expected allow after refill")
	}
	if !b.Allow(later) {
		t.Fatal("expected second allow at capacity")
	}
	if b.Allow(later) {
		t.Fatal("expected deny beyond capacity")
	}
}

func TestFractionalRefill(t *testing.T) {
	b := ratelimit.NewTokenBucket(1, 1)
	now := time.Unix(1000, 0)
	_ = b.Allow(now)
	// 0.5s later should still deny
	mid := now.Add(500 * time.Millisecond)
	if b.Allow(mid) {
		t.Fatal("expected deny with fractional refill < 1")
	}
	full := now.Add(time.Second)
	if !b.Allow(full) {
		t.Fatal("expected allow after full refill")
	}
}

func TestConcurrentAccess(t *testing.T) {
	b := ratelimit.NewTokenBucket(50, 100)
	now := time.Unix(1000, 0)
	var wg sync.WaitGroup
	var mu sync.Mutex
	allowed := 0
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if b.Allow(now) {
				mu.Lock()
				allowed++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if allowed != 50 {
		t.Fatalf("expected 50 allows, got %d", allowed)
	}
}
