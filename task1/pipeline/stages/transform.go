package stages

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/fantasy/fantasy-take-home/task1/pipeline"
)

// TransformOp is one deterministic field mutation applied in order.
type TransformOp struct {
	// Op is one of: "set", "copy", "rename", "remove".
	Op string `json:"op"`
	// Field is the target field for set/remove, or the destination for copy/rename.
	Field string `json:"field"`
	// From is the source field for copy/rename.
	From string `json:"from,omitempty"`
	// Value is the literal assigned by set (any JSON value).
	Value any `json:"value,omitempty"`
}

// TransformConfig holds an ordered list of field operations.
type TransformConfig struct {
	Ops []TransformOp `json:"ops"`
}

type transformStage struct {
	name string
	ops  []TransformOp
}

// NewTransform builds a transform stage after validating operations.
func NewTransform(name string, cfg TransformConfig) (pipeline.Stage, error) {
	if len(cfg.Ops) == 0 {
		return nil, fmt.Errorf("transform: at least one op is required")
	}
	ops := make([]TransformOp, len(cfg.Ops))
	for i, op := range cfg.Ops {
		switch op.Op {
		case "set":
			if op.Field == "" {
				return nil, fmt.Errorf("transform: op[%d] set: field is required", i)
			}
		case "copy", "rename":
			if op.Field == "" || op.From == "" {
				return nil, fmt.Errorf("transform: op[%d] %s: field and from are required", i, op.Op)
			}
		case "remove":
			if op.Field == "" {
				return nil, fmt.Errorf("transform: op[%d] remove: field is required", i)
			}
		default:
			return nil, fmt.Errorf("transform: op[%d]: unknown op %q", i, op.Op)
		}
		ops[i] = op
	}
	return &transformStage{name: name, ops: ops}, nil
}

// NewTransformFromJSON is a registry factory for type "transform".
func NewTransformFromJSON(name string, raw json.RawMessage) (pipeline.Stage, error) {
	var cfg TransformConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("transform: %w", err)
	}
	return NewTransform(name, cfg)
}

func (s *transformStage) Name() string { return s.name }

func (s *transformStage) Setup(context.Context) error { return nil }

func (s *transformStage) Teardown(context.Context) error { return nil }

func (s *transformStage) Process(_ context.Context, rec pipeline.Record) (pipeline.Record, error) {
	if rec == nil {
		return nil, fmt.Errorf("transform: record is nil")
	}
	out := pipeline.Snapshot(rec)
	for _, op := range s.ops {
		switch op.Op {
		case "set":
			out[op.Field] = op.Value
		case "copy":
			v, ok := out[op.From]
			if !ok {
				return nil, fmt.Errorf("transform: copy: source field %q not found", op.From)
			}
			out[op.Field] = v
		case "rename":
			v, ok := out[op.From]
			if !ok {
				return nil, fmt.Errorf("transform: rename: source field %q not found", op.From)
			}
			out[op.Field] = v
			delete(out, op.From)
		case "remove":
			delete(out, op.Field)
		}
	}
	return out, nil
}
