package pipeline

import "context"

// Stage is a pluggable processing unit with a full lifecycle.
// Setup initializes resources; Process handles one record; Teardown cleans up.
// Process returns (nil, nil) to intentionally drop a record without failure.
type Stage interface {
	Name() string
	Setup(ctx context.Context) error
	Process(ctx context.Context, rec Record) (Record, error)
	Teardown(ctx context.Context) error
}
