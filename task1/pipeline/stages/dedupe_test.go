package stages_test

import (
	"context"
	"testing"

	"github.com/fantasy/fantasy-take-home/task1/pipeline"
	"github.com/fantasy/fantasy-take-home/task1/pipeline/stages"
)

func TestDedupeFirstAndDuplicate(t *testing.T) {
	s, err := stages.NewDedupe("d", stages.DedupeConfig{Keys: []string{"id"}})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if err := s.Setup(ctx); err != nil {
		t.Fatal(err)
	}
	if n := stages.SeenLen(s); n != 0 {
		t.Fatalf("seen should start empty, got %d", n)
	}

	first, err := s.Process(ctx, pipeline.Record{"id": "1", "v": "a"})
	if err != nil || first == nil {
		t.Fatalf("first should pass: rec=%v err=%v", first, err)
	}
	dup, err := s.Process(ctx, pipeline.Record{"id": "1", "v": "b"})
	if err != nil {
		t.Fatalf("duplicate must not error: %v", err)
	}
	if dup != nil {
		t.Fatal("duplicate must return (nil, nil)")
	}
	second, err := s.Process(ctx, pipeline.Record{"id": "2"})
	if err != nil || second == nil {
		t.Fatalf("distinct key should pass: rec=%v err=%v", second, err)
	}
	if n := stages.SeenLen(s); n != 2 {
		t.Fatalf("expected 2 seen keys, got %d", n)
	}

	if err := s.Teardown(ctx); err != nil {
		t.Fatal(err)
	}
	if n := stages.SeenLen(s); n != -1 {
		t.Fatalf("teardown should clear seen set, got %d", n)
	}
}

func TestDedupeCompositeKey(t *testing.T) {
	s, err := stages.NewDedupe("d", stages.DedupeConfig{Keys: []string{"a", "b"}})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	_ = s.Setup(ctx)
	defer s.Teardown(ctx)

	r1, err := s.Process(ctx, pipeline.Record{"a": 1, "b": "x"})
	if err != nil || r1 == nil {
		t.Fatal("first composite should pass")
	}
	r2, err := s.Process(ctx, pipeline.Record{"a": 1, "b": "y"})
	if err != nil || r2 == nil {
		t.Fatal("different composite should pass")
	}
	dup, err := s.Process(ctx, pipeline.Record{"a": 1, "b": "x"})
	if err != nil || dup != nil {
		t.Fatalf("same composite should drop: %v %#v", err, dup)
	}
}

func TestDedupeMissingKey(t *testing.T) {
	s, err := stages.NewDedupe("d", stages.DedupeConfig{Keys: []string{"id"}})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	_ = s.Setup(ctx)
	defer s.Teardown(ctx)
	_, err = s.Process(ctx, pipeline.Record{"other": 1})
	if err == nil {
		t.Fatal("expected missing key error")
	}
}
