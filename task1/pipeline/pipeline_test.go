package pipeline_test

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	"github.com/fantasy/fantasy-take-home/task1/pipeline"
)

type hookStage struct {
	name       string
	setupErr   error
	teardownEr error
	processFn  func(context.Context, pipeline.Record) (pipeline.Record, error)

	setupOrder   *[]string
	teardownOrd  *[]string
	processCount *atomic.Int32
}

func (s *hookStage) Name() string { return s.name }

func (s *hookStage) Setup(ctx context.Context) error {
	if s.setupOrder != nil {
		*s.setupOrder = append(*s.setupOrder, s.name)
	}
	return s.setupErr
}

func (s *hookStage) Teardown(ctx context.Context) error {
	if s.teardownOrd != nil {
		*s.teardownOrd = append(*s.teardownOrd, s.name)
	}
	return s.teardownEr
}

func (s *hookStage) Process(ctx context.Context, rec pipeline.Record) (pipeline.Record, error) {
	if s.processCount != nil {
		s.processCount.Add(1)
	}
	if s.processFn != nil {
		return s.processFn(ctx, rec)
	}
	return rec, nil
}

func TestPipelineOrderAndPropagation(t *testing.T) {
	var setup, teardown []string
	a := &hookStage{
		name: "a", setupOrder: &setup, teardownOrd: &teardown,
		processFn: func(_ context.Context, r pipeline.Record) (pipeline.Record, error) {
			r = pipeline.Snapshot(r)
			r["a"] = true
			return r, nil
		},
	}
	b := &hookStage{
		name: "b", setupOrder: &setup, teardownOrd: &teardown,
		processFn: func(_ context.Context, r pipeline.Record) (pipeline.Record, error) {
			r = pipeline.Snapshot(r)
			r["b"] = true
			return r, nil
		},
	}
	p := pipeline.New(a, b)
	res, err := p.Run(context.Background(), []pipeline.Record{{"id": 1}})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Output) != 1 || res.Output[0]["a"] != true || res.Output[0]["b"] != true {
		t.Fatalf("bad output: %#v", res.Output)
	}
	if got := join(setup); got != "a,b" {
		t.Fatalf("setup order: %s", got)
	}
	if got := join(teardown); got != "b,a" {
		t.Fatalf("teardown order: %s", got)
	}
}

func TestPipelineDeadLetterContinues(t *testing.T) {
	fail := &hookStage{
		name: "fail",
		processFn: func(_ context.Context, r pipeline.Record) (pipeline.Record, error) {
			if r["bad"] == true {
				return nil, errors.New("boom")
			}
			return r, nil
		},
	}
	p := pipeline.New(fail)
	res, err := p.Run(context.Background(), []pipeline.Record{
		{"id": 1, "bad": true},
		{"id": 2},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.DeadLetters) != 1 {
		t.Fatalf("expected 1 dead letter, got %d", len(res.DeadLetters))
	}
	if res.DeadLetters[0].Stage != "fail" {
		t.Fatalf("stage name: %s", res.DeadLetters[0].Stage)
	}
	if res.DeadLetters[0].Record["id"] != 1 {
		t.Fatalf("dead letter snapshot: %#v", res.DeadLetters[0].Record)
	}
	if len(res.Output) != 1 || res.Output[0]["id"] != 2 {
		t.Fatalf("expected second record to succeed: %#v", res.Output)
	}
}

func TestPipelineIntentionalDrop(t *testing.T) {
	drop := &hookStage{
		name: "drop",
		processFn: func(_ context.Context, r pipeline.Record) (pipeline.Record, error) {
			if r["dup"] == true {
				return nil, nil
			}
			return r, nil
		},
	}
	p := pipeline.New(drop)
	res, err := p.Run(context.Background(), []pipeline.Record{
		{"id": 1},
		{"id": 2, "dup": true},
		{"id": 3},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Dropped != 1 {
		t.Fatalf("dropped=%d", res.Dropped)
	}
	if len(res.DeadLetters) != 0 {
		t.Fatalf("drops must not dead-letter: %#v", res.DeadLetters)
	}
	if len(res.Output) != 2 {
		t.Fatalf("output=%#v", res.Output)
	}
}

func TestPipelineSetupFailureTeardown(t *testing.T) {
	var teardown []string
	ok := &hookStage{name: "ok", teardownOrd: &teardown}
	bad := &hookStage{name: "bad", setupErr: errors.New("nope"), teardownOrd: &teardown}
	later := &hookStage{name: "later", teardownOrd: &teardown}

	res, err := pipeline.New(ok, bad, later).Run(context.Background(), []pipeline.Record{{}})
	if err == nil {
		t.Fatal("expected setup error")
	}
	if !errors.Is(err, bad.setupErr) && err.Error() == "" {
		t.Fatalf("unexpected err: %v", err)
	}
	if join(teardown) != "ok" {
		t.Fatalf("only successfully set-up stages should teardown, got %v", teardown)
	}
	if len(res.Output) != 0 {
		t.Fatal("no output on setup failure")
	}
}

func TestPipelineTeardownErrorJoined(t *testing.T) {
	primary := errors.New("primary-setup")
	tdErr := errors.New("teardown-failed")
	ok := &hookStage{name: "ok", teardownEr: tdErr}
	bad := &hookStage{name: "bad", setupErr: primary}

	_, err := pipeline.New(ok, bad).Run(context.Background(), nil)
	if err == nil {
		t.Fatal("expected joined error")
	}
	if !errors.Is(err, primary) {
		t.Fatalf("missing primary: %v", err)
	}
	if !errors.Is(err, tdErr) {
		t.Fatalf("missing teardown: %v", err)
	}
}

func TestPipelineCancelBetweenRecords(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	var n atomic.Int32
	s := &hookStage{
		name: "s", processCount: &n,
		processFn: func(ctx context.Context, r pipeline.Record) (pipeline.Record, error) {
			if r["id"] == 1 {
				cancel()
			}
			return r, nil
		},
	}
	res, err := pipeline.New(s).Run(ctx, []pipeline.Record{
		{"id": 1},
		{"id": 2},
		{"id": 3},
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected canceled, got %v", err)
	}
	if res.Unprocessed < 1 {
		t.Fatalf("expected unprocessed records, got %d", res.Unprocessed)
	}
	if len(res.DeadLetters) != 0 {
		t.Fatalf("canceled records must not dead-letter: %#v", res.DeadLetters)
	}
	if n.Load() != 1 {
		t.Fatalf("only first record should process, got %d", n.Load())
	}
}

func TestPipelineCancelMidRecord(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	first := &hookStage{
		name: "first",
		processFn: func(_ context.Context, r pipeline.Record) (pipeline.Record, error) {
			cancel()
			return r, nil
		},
	}
	second := &hookStage{
		name: "second",
		processFn: func(context.Context, pipeline.Record) (pipeline.Record, error) {
			t.Fatal("second stage should not run after cancel")
			return nil, nil
		},
	}
	res, err := pipeline.New(first, second).Run(ctx, []pipeline.Record{{"id": 1}, {"id": 2}})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected canceled, got %v", err)
	}
	if len(res.Output) != 0 {
		t.Fatalf("in-flight record must be abandoned: %#v", res.Output)
	}
	if len(res.DeadLetters) != 0 {
		t.Fatalf("abandoned record must not dead-letter: %#v", res.DeadLetters)
	}
	if res.Unprocessed < 1 {
		t.Fatalf("unprocessed=%d", res.Unprocessed)
	}
}

func TestPipelineCancelErrorFromStageWhileCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	s := &hookStage{
		name: "s",
		processFn: func(ctx context.Context, r pipeline.Record) (pipeline.Record, error) {
			cancel()
			return nil, ctx.Err()
		},
	}
	res, err := pipeline.New(s).Run(ctx, []pipeline.Record{{"id": 1}})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected canceled, got %v", err)
	}
	if len(res.DeadLetters) != 0 {
		t.Fatalf("context error while canceled must abandon, not dead-letter")
	}
}

func TestPipelineContextErrorWhileActiveIsDeadLetter(t *testing.T) {
	s := &hookStage{
		name: "s",
		processFn: func(context.Context, pipeline.Record) (pipeline.Record, error) {
			return nil, context.Canceled
		},
	}
	res, err := pipeline.New(s).Run(context.Background(), []pipeline.Record{{"id": 1}, {"id": 2}})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.DeadLetters) != 2 {
		t.Fatalf("context-shaped error without cancel is a failure: %#v", res.DeadLetters)
	}
}

func join(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ","
		}
		out += p
	}
	return out
}
