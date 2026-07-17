package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/fantasy/fantasy-take-home/task3/server/internal/model"
	"github.com/fantasy/fantasy-take-home/task3/server/internal/store"
)

// Handlers serves the roster API endpoints against a RosterStore.
type Handlers struct {
	Store store.RosterStore
}

// NewMux builds the HTTP mux with handlers only (no middleware).
func NewMux(h *Handlers) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/players", h.handlePlayers)
	mux.HandleFunc("/roster", h.handleRoster)
	mux.HandleFunc("/", h.handleNotFound)
	return mux
}

func (h *Handlers) handlePlayers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed", nil)
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	players, err := h.Store.ListPlayers(r.Context(), q)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal_error", "Internal server error", nil)
		return
	}
	if players == nil {
		players = []model.Player{}
	}
	WriteJSON(w, http.StatusOK, model.PlayersResponse{Players: players})
}

func (h *Handlers) handleRoster(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed", nil)
		return
	}
	var req model.AddToRosterRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid_request", "Malformed or invalid request body", nil)
		return
	}
	req.PlayerID = strings.TrimSpace(req.PlayerID)
	if req.PlayerID == "" {
		WriteError(w, http.StatusBadRequest, "invalid_request", "playerId is required", nil)
		return
	}

	roster, err := h.Store.AddPlayer(r.Context(), req.PlayerID)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrPlayerNotFound):
			WriteError(w, http.StatusNotFound, "player_not_found", "Player not found", nil)
		case errors.Is(err, store.ErrPlayerAlreadyRostered):
			WriteError(w, http.StatusConflict, "player_already_rostered", "Player is already on the roster", nil)
		default:
			WriteError(w, http.StatusInternalServerError, "internal_error", "Internal server error", nil)
		}
		return
	}
	if roster.Players == nil {
		roster.Players = []model.Player{}
	}
	WriteJSON(w, http.StatusCreated, model.RosterResponse{Roster: roster})
}

func (h *Handlers) handleNotFound(w http.ResponseWriter, r *http.Request) {
	WriteError(w, http.StatusNotFound, "not_found", "Not found", nil)
}
