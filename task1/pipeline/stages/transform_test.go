package stages_test

import (
	"context"
	"testing"

	"github.com/fantasy/fantasy-take-home/task1/pipeline"
	"github.com/fantasy/fantasy-take-home/task1/pipeline/stages"
)

func TestTransformOps(t *testing.T) {
	s, err := stages.NewTransform("t", stages.TransformConfig{
		Ops: []stages.TransformOp{
			{Op: "set", Field: "status", Value: "new"},
			{Op: "copy", Field: "name_copy", From: "name"},
			{Op: "rename", Field: "full_name", From: "name"},
			{Op: "remove", Field: "tmp"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	_ = s.Setup(ctx)
	defer s.Teardown(ctx)

	in := pipeline.Record{"name": "Ada", "tmp": true, "keep": 1}
	out, err := s.Process(ctx, in)
	if err != nil {
		t.Fatal(err)
	}
	if out["status"] != "new" {
		t.Fatalf("set failed: %#v", out)
	}
	if out["name_copy"] != "Ada" {
		t.Fatalf("copy failed: %#v", out)
	}
	if out["full_name"] != "Ada" {
		t.Fatalf("rename failed: %#v", out)
	}
	if _, ok := out["name"]; ok {
		t.Fatal("rename should remove source")
	}
	if _, ok := out["tmp"]; ok {
		t.Fatal("remove should delete field")
	}
	if _, ok := in["status"]; ok {
		t.Fatal("transform must not mutate input")
	}
}

func TestTransformOpOrder(t *testing.T) {
	s, err := stages.NewTransform("t", stages.TransformConfig{
		Ops: []stages.TransformOp{
			{Op: "set", Field: "x", Value: 1},
			{Op: "set", Field: "x", Value: 2},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	out, err := s.Process(context.Background(), pipeline.Record{})
	if err != nil {
		t.Fatal(err)
	}
	if out["x"] != float64(2) && out["x"] != 2 {
		if out["x"] != 2 {
			t.Fatalf("ops should apply in order, got %#v", out["x"])
		}
	}
}

func TestTransformMissingSource(t *testing.T) {
	s, err := stages.NewTransform("t", stages.TransformConfig{
		Ops: []stages.TransformOp{{Op: "copy", Field: "b", From: "a"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.Process(context.Background(), pipeline.Record{})
	if err == nil {
		t.Fatal("expected missing source error")
	}
}
