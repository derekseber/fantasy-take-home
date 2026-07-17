package api

import (
	"encoding/json"
	"net/http"
)

// ErrorBody is the documented API error envelope.
type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail carries a stable code, human message, and optional details.
type ErrorDetail struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

// WriteJSON writes a success JSON body with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// WriteError writes a consistent error envelope.
func WriteError(w http.ResponseWriter, status int, code, message string, details map[string]any) {
	WriteJSON(w, status, ErrorBody{
		Error: ErrorDetail{
			Code:    code,
			Message: message,
			Details: details,
		},
	})
}
