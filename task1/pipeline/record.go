package pipeline

import "fmt"

// Record is a JSON-shaped in-memory document. Stages may add or update fields.
type Record map[string]any

// DeadLetter captures a record that failed a stage, with enough context to
// diagnose the failure without re-running the pipeline.
type DeadLetter struct {
	Stage  string
	Err    error
	Record Record
}

func (d DeadLetter) Error() string {
	return fmt.Sprintf("stage %q: %v", d.Stage, d.Err)
}

// Snapshot returns a shallow copy of r so later mutations do not rewrite history.
func Snapshot(r Record) Record {
	if r == nil {
		return nil
	}
	out := make(Record, len(r))
	for k, v := range r {
		out[k] = v
	}
	return out
}
