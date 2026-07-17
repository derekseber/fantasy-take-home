package stages

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/fantasy/fantasy-take-home/task1/pipeline"
)

// DedupeConfig configures the key fields used for uniqueness.
type DedupeConfig struct {
	// Keys lists field names concatenated into the dedupe key.
	Keys []string `json:"keys"`
}

type dedupeStage struct {
	name string
	keys []string
	seen map[string]struct{}
}

// NewDedupe builds a dedupe stage. The seen-set is allocated in Setup.
func NewDedupe(name string, cfg DedupeConfig) (pipeline.Stage, error) {
	if len(cfg.Keys) == 0 {
		return nil, fmt.Errorf("dedupe: at least one key field is required")
	}
	keys := make([]string, len(cfg.Keys))
	copy(keys, cfg.Keys)
	return &dedupeStage{name: name, keys: keys}, nil
}

// NewDedupeFromJSON is a registry factory for type "dedupe".
func NewDedupeFromJSON(name string, raw json.RawMessage) (pipeline.Stage, error) {
	var cfg DedupeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("dedupe: %w", err)
	}
	return NewDedupe(name, cfg)
}

func (s *dedupeStage) Name() string { return s.name }

func (s *dedupeStage) Setup(context.Context) error {
	s.seen = make(map[string]struct{})
	return nil
}

func (s *dedupeStage) Teardown(context.Context) error {
	s.seen = nil
	return nil
}

func (s *dedupeStage) Process(_ context.Context, rec pipeline.Record) (pipeline.Record, error) {
	if s.seen == nil {
		return nil, fmt.Errorf("dedupe: Process called before Setup")
	}
	if rec == nil {
		return nil, fmt.Errorf("dedupe: record is nil")
	}
	key, err := s.keyFor(rec)
	if err != nil {
		return nil, err
	}
	if _, exists := s.seen[key]; exists {
		// Intentional drop: (nil, nil) — not a failure.
		return nil, nil
	}
	s.seen[key] = struct{}{}
	return rec, nil
}

func (s *dedupeStage) keyFor(rec pipeline.Record) (string, error) {
	parts := make([]string, len(s.keys))
	for i, field := range s.keys {
		v, ok := rec[field]
		if !ok || v == nil {
			return "", fmt.Errorf("dedupe: missing key field %q", field)
		}
		b, err := json.Marshal(v)
		if err != nil {
			return "", fmt.Errorf("dedupe: key field %q: %w", field, err)
		}
		parts[i] = string(b)
	}
	return strings.Join(parts, "\x1f"), nil
}

// SeenLen reports how many unique keys are currently tracked. Intended for tests.
func SeenLen(s pipeline.Stage) int {
	d, ok := s.(*dedupeStage)
	if !ok || d.seen == nil {
		return -1
	}
	return len(d.seen)
}
