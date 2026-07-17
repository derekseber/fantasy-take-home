package pipeline

import (
	"encoding/json"
	"fmt"
)

// Factory constructs a Stage from a name and raw JSON config options.
type Factory func(name string, raw json.RawMessage) (Stage, error)

// Registry maps stage type names to factories.
type Registry struct {
	factories map[string]Factory
}

// NewRegistry returns an empty registry.
func NewRegistry() *Registry {
	return &Registry{factories: make(map[string]Factory)}
}

// Register associates a type name with a factory. Panics on duplicate type.
func (r *Registry) Register(typeName string, f Factory) {
	if _, exists := r.factories[typeName]; exists {
		panic(fmt.Sprintf("pipeline: duplicate stage type %q", typeName))
	}
	r.factories[typeName] = f
}

// stageConfig is one entry in a pipeline JSON config.
type stageConfig struct {
	Name   string          `json:"name"`
	Type   string          `json:"type"`
	Config json.RawMessage `json:"config"`
}

// Config is the top-level JSON configuration document.
type Config struct {
	Stages []stageConfig `json:"stages"`
}

// Build constructs an ordered Pipeline from JSON config using registered factories.
func (r *Registry) Build(cfg Config) (*Pipeline, error) {
	if len(cfg.Stages) == 0 {
		return nil, fmt.Errorf("pipeline: config must declare at least one stage")
	}
	seen := make(map[string]struct{}, len(cfg.Stages))
	stages := make([]Stage, 0, len(cfg.Stages))
	for i, sc := range cfg.Stages {
		if sc.Name == "" {
			return nil, fmt.Errorf("pipeline: stage[%d]: name is required", i)
		}
		if sc.Type == "" {
			return nil, fmt.Errorf("pipeline: stage[%d] %q: type is required", i, sc.Name)
		}
		if _, dup := seen[sc.Name]; dup {
			return nil, fmt.Errorf("pipeline: duplicate stage name %q", sc.Name)
		}
		seen[sc.Name] = struct{}{}
		factory, ok := r.factories[sc.Type]
		if !ok {
			return nil, fmt.Errorf("pipeline: unknown stage type %q", sc.Type)
		}
		cfgBytes := sc.Config
		if cfgBytes == nil {
			cfgBytes = json.RawMessage(`{}`)
		}
		stage, err := factory(sc.Name, cfgBytes)
		if err != nil {
			return nil, fmt.Errorf("pipeline: stage %q: %w", sc.Name, err)
		}
		stages = append(stages, stage)
	}
	return New(stages...), nil
}

// BuildFromJSON parses JSON bytes and builds a pipeline.
func (r *Registry) BuildFromJSON(data []byte) (*Pipeline, error) {
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("pipeline: invalid config JSON: %w", err)
	}
	return r.Build(cfg)
}
