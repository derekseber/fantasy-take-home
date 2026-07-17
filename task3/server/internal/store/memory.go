package store

import (
	"context"
	"sort"
	"strings"
	"sync"

	"github.com/fantasy/fantasy-take-home/task3/server/internal/model"
)

// MemoryStore is an in-memory RosterStore.
type MemoryStore struct {
	mu      sync.Mutex
	players map[string]model.Player
	roster  []string // ordered player IDs
}

// NewMemoryStore seeds a small catalog and an empty roster.
func NewMemoryStore(seed []model.Player) *MemoryStore {
	players := make(map[string]model.Player, len(seed))
	for _, p := range seed {
		players[p.ID] = p
	}
	return &MemoryStore{
		players: players,
		roster:  nil,
	}
}

// DefaultSeed returns the demo player catalog.
func DefaultSeed() []model.Player {
	return []model.Player{
		{ID: "p1", Name: "Avery Stone", Position: "QB", Team: "BOS"},
		{ID: "p2", Name: "Blake Rivera", Position: "RB", Team: "NY"},
		{ID: "p3", Name: "Casey Nguyen", Position: "WR", Team: "CHI"},
		{ID: "p4", Name: "Devon Park", Position: "TE", Team: "DAL"},
		{ID: "p5", Name: "Ellis Morgan", Position: "K", Team: "SEA"},
		{ID: "p6", Name: "Finley Brooks", Position: "DEF", Team: "DEN"},
		{ID: "p7", Name: "Gray Ellis", Position: "QB", Team: "MIA"},
		{ID: "p8", Name: "Harper Quinn", Position: "WR", Team: "GB"},
	}
}

// ListPlayers returns the full seeded catalog filtered by optional name substring.
func (s *MemoryStore) ListPlayers(_ context.Context, nameQuery string) ([]model.Player, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	q := strings.ToLower(strings.TrimSpace(nameQuery))
	out := make([]model.Player, 0, len(s.players))
	for _, p := range s.players {
		if q == "" || strings.Contains(strings.ToLower(p.Name), q) {
			out = append(out, p)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Name < out[j].Name
	})
	return out, nil
}

// AddPlayer adds a catalog player to the roster atomically.
func (s *MemoryStore) AddPlayer(_ context.Context, playerID string) (model.Roster, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.players[playerID]; !ok {
		return model.Roster{}, ErrPlayerNotFound
	}
	for _, id := range s.roster {
		if id == playerID {
			return model.Roster{}, ErrPlayerAlreadyRostered
		}
	}
	s.roster = append(s.roster, playerID)
	return s.snapshotRosterLocked(), nil
}

func (s *MemoryStore) snapshotRosterLocked() model.Roster {
	players := make([]model.Player, 0, len(s.roster))
	for _, id := range s.roster {
		if p, ok := s.players[id]; ok {
			players = append(players, p)
		}
	}
	return model.Roster{Players: players}
}
