package stages

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/fantasy/fantasy-take-home/task1/pipeline"
)

// ValidateConfig configures the validate stage.
type ValidateConfig struct {
	// Required lists field names that must be present and non-nil.
	Required []string `json:"required"`
	// Types maps field names to expected JSON-compatible types:
	// "string", "number", "bool", "object", "array".
	Types map[string]string `json:"types"`
}

type validateStage struct {
	name string
	cfg  ValidateConfig
}

// NewValidate builds a validate stage. Factories should prefer NewValidateFromJSON.
func NewValidate(name string, cfg ValidateConfig) (pipeline.Stage, error) {
	for _, t := range cfg.Types {
		switch t {
		case "string", "number", "bool", "object", "array":
		default:
			return nil, fmt.Errorf("validate: unsupported type %q", t)
		}
	}
	return &validateStage{name: name, cfg: cfg}, nil
}

// NewValidateFromJSON is a registry factory for type "validate".
func NewValidateFromJSON(name string, raw json.RawMessage) (pipeline.Stage, error) {
	var cfg ValidateConfig
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &cfg); err != nil {
			return nil, fmt.Errorf("validate: %w", err)
		}
	}
	return NewValidate(name, cfg)
}

func (s *validateStage) Name() string { return s.name }

func (s *validateStage) Setup(context.Context) error { return nil }

func (s *validateStage) Teardown(context.Context) error { return nil }

func (s *validateStage) Process(_ context.Context, rec pipeline.Record) (pipeline.Record, error) {
	if rec == nil {
		return nil, fmt.Errorf("validate: record is nil")
	}
	for _, field := range s.cfg.Required {
		v, ok := rec[field]
		if !ok || v == nil {
			return nil, fmt.Errorf("validate: missing required field %q", field)
		}
	}
	for field, want := range s.cfg.Types {
		v, ok := rec[field]
		if !ok || v == nil {
			continue // optional unless also in Required
		}
		if err := checkType(field, v, want); err != nil {
			return nil, err
		}
	}
	return rec, nil
}

func checkType(field string, v any, want string) error {
	switch want {
	case "string":
		if _, ok := v.(string); !ok {
			return fmt.Errorf("validate: field %q: want string, got %T", field, v)
		}
	case "number":
		switch v.(type) {
		case float64, float32, int, int32, int64, json.Number:
			// ok
		default:
			return fmt.Errorf("validate: field %q: want number, got %T", field, v)
		}
	case "bool":
		if _, ok := v.(bool); !ok {
			return fmt.Errorf("validate: field %q: want bool, got %T", field, v)
		}
	case "object":
		rv := reflect.ValueOf(v)
		if rv.Kind() != reflect.Map {
			return fmt.Errorf("validate: field %q: want object, got %T", field, v)
		}
	case "array":
		rv := reflect.ValueOf(v)
		if rv.Kind() != reflect.Slice && rv.Kind() != reflect.Array {
			return fmt.Errorf("validate: field %q: want array, got %T", field, v)
		}
	}
	return nil
}
