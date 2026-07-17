package store_test

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/fantasy/fantasy-take-home/task3/server/internal/store"
)

func TestListPlayersFilterAndOrder(t *testing.T) {
	s := store.NewMemoryStore(store.DefaultSeed())
	all, err := s.ListPlayers(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 8 {
		t.Fatalf("expected 8 players, got %d", len(all))
	}
	for i := 1; i < len(all); i++ {
		if all[i-1].Name > all[i].Name {
			t.Fatalf("not sorted: %q > %q", all[i-1].Name, all[i].Name)
		}
	}

	filtered, err := s.ListPlayers(context.Background(), "  ELLIS  ")
	if err != nil {
		t.Fatal(err)
	}
	// "Ellis Morgan" and "Gray Ellis"
	if len(filtered) != 2 {
		t.Fatalf("expected 2 matches, got %d", len(filtered))
	}
}

func TestListPlayersDoesNotExcludeRostered(t *testing.T) {
	s := store.NewMemoryStore(store.DefaultSeed())
	_, err := s.AddPlayer(context.Background(), "p1")
	if err != nil {
		t.Fatal(err)
	}
	all, err := s.ListPlayers(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, p := range all {
		if p.ID == "p1" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("rostered player should still appear in full catalog")
	}
}

func TestAddPlayerSuccessAndDuplicate(t *testing.T) {
	s := store.NewMemoryStore(store.DefaultSeed())
	roster, err := s.AddPlayer(context.Background(), "p1")
	if err != nil {
		t.Fatal(err)
	}
	if len(roster.Players) != 1 || roster.Players[0].ID != "p1" {
		t.Fatalf("unexpected roster: %+v", roster)
	}
	_, err = s.AddPlayer(context.Background(), "p1")
	if !errors.Is(err, store.ErrPlayerAlreadyRostered) {
		t.Fatalf("expected already rostered, got %v", err)
	}
}

func TestAddPlayerNotFound(t *testing.T) {
	s := store.NewMemoryStore(store.DefaultSeed())
	_, err := s.AddPlayer(context.Background(), "missing")
	if !errors.Is(err, store.ErrPlayerNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestAddPlayerDefensiveCopy(t *testing.T) {
	s := store.NewMemoryStore(store.DefaultSeed())
	roster, err := s.AddPlayer(context.Background(), "p1")
	if err != nil {
		t.Fatal(err)
	}
	roster.Players[0].Name = "MUTATED"
	again, err := s.AddPlayer(context.Background(), "p2")
	if err != nil {
		t.Fatal(err)
	}
	if again.Players[0].Name == "MUTATED" {
		t.Fatal("store leaked mutable slice")
	}
}

func TestConcurrentAdds(t *testing.T) {
	s := store.NewMemoryStore(store.DefaultSeed())
	var wg sync.WaitGroup
	var mu sync.Mutex
	success := 0
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.AddPlayer(context.Background(), "p3")
			if err == nil {
				mu.Lock()
				success++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if success != 1 {
		t.Fatalf("expected exactly one successful add, got %d", success)
	}
}
