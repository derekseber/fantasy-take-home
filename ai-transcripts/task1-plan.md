# Task 1 Architecture Plan

## Core API

- `Record` is `map[string]any`, matching JSON-shaped in-memory input while allowing stages to add or update fields.
- `Stage` exposes `Name() string`, `Setup(context.Context) error`, `Process(context.Context, Record) (Record, error)`, and `Teardown(context.Context) error`.
- Stages are composed as one ordered linear slice. No branching or DAG execution is supported.

## Pipeline.Run

1. Set up stages in configured order. Track only successfully initialized stages.
2. Once any setup succeeds, always tear those stages down in reverse order, including after setup failure or cancellation.
3. Pass each record through stages in order. A stage error creates a dead-letter entry containing the stage name, wrapped error, and a snapshot of the record at failure; that record stops processing, while later records continue.
4. Successful records are collected as output. Intentional drops are distinct from failures (see "Drop vs. failure semantics" below).
5. Cancellation is honored at defined checkpoints (see "Cancellation semantics" below) and always results in `Run` returning `ctx.Err()` after teardown.
6. Teardown uses a fresh cleanup context that is not already canceled, so every initialized stage gets a cleanup attempt (see "Teardown error handling" below).

### Drop vs. failure semantics

`Process` returns `(Record, error)`; drops and failures are distinguished as follows:

- **Failure**: `Process` returns a non-nil error. The record is dead-lettered with stage name, error, and record snapshot.
- **Intentional drop**: `Process` returns `(nil, nil)` — a nil record with a nil error. The record is silently removed from the flow: it does not reach later stages, does not appear in the output, and does not create a dead letter. The pipeline counts drops in the run result so tests and callers can assert on them. `dedupe` uses this to discard duplicates.
- **Success**: `Process` returns a non-nil record with a nil error; the record continues to the next stage.

No sentinel error (e.g. `ErrSkip`) is used for drops, so every non-nil error unambiguously means failure.

### Teardown error handling

The primary run error (setup failure or `ctx.Err()` from cancellation) and any teardown errors are combined with `errors.Join`, so `Run` returns a single error and callers can still detect specific causes with `errors.Is`/`errors.As`. Teardown errors never mask the primary error, and a teardown failure in one stage does not prevent the remaining stages from being torn down. Dead letters are not errors of the run itself: `Run` returns its collected outputs and dead letters in the result even when it also returns an error.

### Cancellation semantics

Cancellation is checked at two checkpoints: before starting each record, and before each stage invocation within a record.

- **Between records**: if the context is canceled before a record starts, that record and all remaining records are left unprocessed — no dead letters are created for them. `Run` proceeds to teardown and returns `ctx.Err()`.
- **Mid-record**: if the context is canceled between stages of an in-flight record, or a stage returns an error wrapping `context.Canceled`/`context.DeadlineExceeded` while the run context is canceled, the in-flight record is abandoned: it is neither output nor dead-lettered, because the failure reflects shutdown rather than anything wrong with the record. `Run` then proceeds to teardown and returns `ctx.Err()`.
- A context-shaped error from a stage while the run context is *not* canceled is treated as an ordinary stage failure and dead-letters the record.

The run result reports how many records were left unprocessed so shutdown behavior is observable in tests.

## Registry and JSON Configuration

- A registry maps a stage type string to a factory that validates raw JSON options and constructs a `Stage`.
- Configuration shape:
  - top-level `stages` array
  - each item has `name`, `type`, and type-specific `config`
- Construction rejects duplicate names, unknown types, malformed options, and invalid stage settings before `Run`.
- Builder functions remain small: register built-ins, parse JSON config, then construct the ordered pipeline.

## Package Layout

- `pipeline/record.go` — record, process outcome, and dead-letter types
- `pipeline/stage.go` — stage lifecycle interface
- `pipeline/pipeline.go` — orchestration and run result
- `pipeline/registry.go` — registry, factories, and JSON config loading
- `pipeline/stages/validate.go` — schema validation
- `pipeline/stages/transform.go` — field transformation
- `pipeline/stages/dedupe.go` — deduplication
- corresponding `_test.go` files beside each implementation
- `README.md` — configuration example and usage

## Built-in Stages

- `validate`: requires configured fields and optionally checks simple JSON-compatible types. It owns immutable validated rules after construction and no runtime mutable state.
- `transform`: copies, renames, removes, or assigns configured fields using deterministic stdlib-only operations. It owns immutable compiled transformation settings.
- `dedupe`: computes a key from configured fields. It allocates its `seen` set in `Setup`, updates it in `Process`, and clears/releases it in `Teardown`.

## Test Plan

- Validate stage: required-field success/failure and type mismatch.
- Transform stage: each supported operation, operation ordering, and input mutation expectations.
- Dedupe stage: setup initialization, first/duplicate outcomes, composite keys, and teardown cleanup.
- Registry/config: valid ordered construction plus unknown type, duplicate name, and malformed config failures.
- Pipeline orchestration: setup and process order, output propagation, per-record dead letters with record snapshots, continuation after failure, intentional drops via `(nil, nil)` counted in the run result, setup failure cleanup, reverse teardown, teardown errors joined with the primary error via `errors.Join`, cancellation between records (remaining records unprocessed, no dead letters), and cancellation mid-record (in-flight record abandoned without a dead letter).
- Run `go test ./...` and `go test -race ./...`.

## Rejected Alternatives

1. DAG/workflow engine: adds scheduling, dependency, and branching complexity that conflicts with the required linear ordered composition.
2. A single `Process` function without lifecycle hooks: cannot reliably initialize and release stateful resources such as the dedupe set.
3. Fail-fast record processing or a shared error-only log: fail-fast violates per-record isolation, while an unstructured log loses the stage and record context needed for dead-letter handling.
