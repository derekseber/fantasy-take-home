package pipeline

import (
	"context"
	"errors"
	"fmt"
)

// Result holds the outcomes of a single Pipeline.Run call.
type Result struct {
	Output      []Record
	DeadLetters []DeadLetter
	Dropped     int // intentional drops (e.g. dedupe), not failures
	Unprocessed int // records left untouched due to cancellation
}

// Pipeline is an ordered linear composition of stages.
type Pipeline struct {
	stages []Stage
}

// New builds a pipeline from an ordered slice of stages.
func New(stages ...Stage) *Pipeline {
	copied := make([]Stage, len(stages))
	copy(copied, stages)
	return &Pipeline{stages: copied}
}

// Stages returns the configured stages in order.
func (p *Pipeline) Stages() []Stage {
	out := make([]Stage, len(p.stages))
	copy(out, p.stages)
	return out
}

// Run processes records through every stage. It always tears down stages that
// successfully completed Setup, even on setup failure or cancellation.
func (p *Pipeline) Run(ctx context.Context, records []Record) (Result, error) {
	var result Result
	var setupErr error
	started := make([]Stage, 0, len(p.stages))

	for _, s := range p.stages {
		if err := ctx.Err(); err != nil {
			setupErr = err
			break
		}
		if err := s.Setup(ctx); err != nil {
			setupErr = fmt.Errorf("setup stage %q: %w", s.Name(), err)
			break
		}
		started = append(started, s)
	}

	if setupErr != nil {
		teardownErr := teardownAll(started)
		return result, errors.Join(setupErr, teardownErr)
	}

	for i, rec := range records {
		if err := ctx.Err(); err != nil {
			result.Unprocessed = len(records) - i
			teardownErr := teardownAll(started)
			return result, errors.Join(err, teardownErr)
		}

		out, aborted, dl, dropped := processRecord(ctx, p.stages, rec)
		if aborted {
			// Mid-record cancellation: abandon in-flight record, leave rest unprocessed.
			result.Unprocessed = len(records) - i
			teardownErr := teardownAll(started)
			return result, errors.Join(ctx.Err(), teardownErr)
		}
		if dropped {
			result.Dropped++
			continue
		}
		if dl != nil {
			result.DeadLetters = append(result.DeadLetters, *dl)
			continue
		}
		result.Output = append(result.Output, out)
	}

	teardownErr := teardownAll(started)
	return result, teardownErr
}

// processRecord runs one record through all stages.
// aborted=true means cancellation abandoned the record (no dead letter).
func processRecord(ctx context.Context, stages []Stage, rec Record) (out Record, aborted bool, dl *DeadLetter, dropped bool) {
	cur := Snapshot(rec)
	for _, s := range stages {
		if err := ctx.Err(); err != nil {
			return nil, true, nil, false
		}
		next, err := s.Process(ctx, cur)
		if err != nil {
			if ctx.Err() != nil && (errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)) {
				return nil, true, nil, false
			}
			letter := DeadLetter{
				Stage:  s.Name(),
				Err:    err,
				Record: Snapshot(cur),
			}
			return nil, false, &letter, false
		}
		if next == nil {
			return nil, false, nil, true
		}
		cur = next
	}
	return cur, false, nil, false
}

func teardownAll(started []Stage) error {
	cleanupCtx := context.Background()
	var errs []error
	for i := len(started) - 1; i >= 0; i-- {
		s := started[i]
		if err := s.Teardown(cleanupCtx); err != nil {
			errs = append(errs, fmt.Errorf("teardown stage %q: %w", s.Name(), err))
		}
	}
	return errors.Join(errs...)
}
