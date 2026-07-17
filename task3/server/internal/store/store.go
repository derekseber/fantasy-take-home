package store

import (
	"context"
	"errors"

	"github.com/fantasy/fantasy-take-home/task3/server/internal/model"
)

var (
	// ErrPlayerNotFound is returned when a player ID is not in the catalog.
	ErrPlayerNotFound = errors.New("player not found")
	// ErrPlayerAlreadyRostered is returned when the player is already on the roster.
	ErrPlayerAlreadyRostered = errors.New("player already rostered")
)

// RosterStore is the handler-facing persistence boundary.
type RosterStore interface {
	ListPlayers(ctx context.Context, nameQuery string) ([]model.Player, error)
	AddPlayer(ctx context.Context, playerID string) (model.Roster, error)
}
