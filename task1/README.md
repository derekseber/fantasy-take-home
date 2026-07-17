# Task 1 — Pluggable Data Processing Pipeline

In-memory Go pipeline: ordered stages, JSON config + registry, per-record dead letters, and context cancellation.

## Layout

```
task1/pipeline/
  record.go      Record, DeadLetter, Snapshot
  stage.go       Stage lifecycle interface
  pipeline.go    Pipeline.Run orchestration
  registry.go    type → factory registry + JSON config
  stages/
    validate.go  required fields + simple type checks
    transform.go set / copy / rename / remove
    dedupe.go    seen-set allocated in Setup
    register.go  RegisterBuiltins / DefaultRegistry
```

## Quick start

```go
reg := stages.DefaultRegistry()
p, err := reg.BuildFromJSON([]byte(`{
  "stages": [
    {"name": "require_id", "type": "validate", "config": {"required": ["id"], "types": {"id": "string"}}},
    {"name": "tag", "type": "transform", "config": {"ops": [{"op": "set", "field": "source", "value": "ingest"}]}},
    {"name": "unique", "type": "dedupe", "config": {"keys": ["id"]}}
  ]
}`))
if err != nil {
  log.Fatal(err)
}

res, err := p.Run(ctx, []pipeline.Record{
  {"id": "a"},
  {"id": "a"},
  {"name": "missing"},
})
// res.Output, res.DeadLetters, res.Dropped, res.Unprocessed
```

## Semantics

| Outcome | `Process` return | Pipeline behavior |
|---------|------------------|-------------------|
| Success | `(record, nil)` | Continue to next stage / collect output |
| Drop | `(nil, nil)` | Silent drop; increments `Result.Dropped` |
| Failure | `(?, err)` | Dead letter with stage name + snapshot; continue with next record |

Cancellation is checked before each record and before each stage. Mid-record cancel abandons the in-flight record (no dead letter). After any successful Setup, Teardown always runs in reverse order on a fresh background context; teardown errors are `errors.Join`ed with the primary run error.

## Tests

```bash
go test ./task1/pipeline/...
go test -race ./task1/pipeline/...
```
