package model

// Player is a catalog entry returned by GET /players and nested in roster responses.
type Player struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Position string `json:"position"`
	Team     string `json:"team"`
}

// Roster is the current set of rostered players.
type Roster struct {
	Players []Player `json:"players"`
}

// PlayersResponse is the GET /players success body.
type PlayersResponse struct {
	Players []Player `json:"players"`
}

// AddToRosterRequest is the POST /roster request body.
type AddToRosterRequest struct {
	PlayerID string `json:"playerId"`
}

// RosterResponse is the POST /roster success body.
type RosterResponse struct {
	Roster Roster `json:"roster"`
}
