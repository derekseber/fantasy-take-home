package stages_test

import (
	"context"
	"testing"

	"github.com/fantasy/fantasy-take-home/task1/pipeline"
	"github.com/fantasy/fantasy-take-home/task1/pipeline/stages"
)

func TestValidateRequiredAndTypes(t *testing.T) {
	s, err := stages.NewValidate("v", stages.ValidateConfig{
		Required: []string{"id", "name"},
		Types:    map[string]string{"id": "string", "age": "number", "active": "bool"},
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if err := s.Setup(ctx); err != nil {
		t.Fatal(err)
	}
	defer s.Teardown(ctx)

	ok := pipeline.Record{"id": "a", "name": "Ada", "age": float64(30), "active": true}
	out, err := s.Process(ctx, ok)
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if out["id"] != "a" {
		t.Fatalf("unexpected output: %#v", out)
	}

	_, err = s.Process(ctx, pipeline.Record{"id": "a"})
	if err == nil {
		t.Fatal("expected missing required field error")
	}

	_, err = s.Process(ctx, pipeline.Record{"id": 1, "name": "x"})
	if err == nil {
		t.Fatal("expected type mismatch error")
	}
}

func TestValidateRejectsUnknownType(t *testing.T) {
	_, err := stages.NewValidate("v", stages.ValidateConfig{
		Types: map[string]string{"x": "uuid"},
	})
	if err == nil {
		t.Fatal("expected unsupported type error")
	}
}
