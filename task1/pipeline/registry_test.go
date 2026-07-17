package pipeline_test

import (
	"context"
	"strings"
	"testing"

	"github.com/fantasy/fantasy-take-home/task1/pipeline"
	"github.com/fantasy/fantasy-take-home/task1/pipeline/stages"
)

func TestRegistryBuildFromJSON(t *testing.T) {
	r := stages.DefaultRegistry()
	cfg := []byte(`{
		"stages": [
			{"name": "require_id", "type": "validate", "config": {"required": ["id"], "types": {"id": "string"}}},
			{"name": "tag", "type": "transform", "config": {"ops": [{"op": "set", "field": "source", "value": "pipeline"}]}},
			{"name": "unique", "type": "dedupe", "config": {"keys": ["id"]}}
		]
	}`)
	p, err := r.BuildFromJSON(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Stages()) != 3 {
		t.Fatalf("expected 3 stages, got %d", len(p.Stages()))
	}
	names := []string{p.Stages()[0].Name(), p.Stages()[1].Name(), p.Stages()[2].Name()}
	if names[0] != "require_id" || names[1] != "tag" || names[2] != "unique" {
		t.Fatalf("order/names: %v", names)
	}
}

func TestRegistryUnknownType(t *testing.T) {
	r := stages.DefaultRegistry()
	_, err := r.BuildFromJSON([]byte(`{"stages":[{"name":"x","type":"magic","config":{}}]}`))
	if err == nil || !strings.Contains(err.Error(), "unknown stage type") {
		t.Fatalf("expected unknown type error, got %v", err)
	}
}

func TestRegistryDuplicateName(t *testing.T) {
	r := stages.DefaultRegistry()
	_, err := r.BuildFromJSON([]byte(`{
		"stages": [
			{"name": "a", "type": "validate", "config": {}},
			{"name": "a", "type": "dedupe", "config": {"keys": ["id"]}}
		]
	}`))
	if err == nil || !strings.Contains(err.Error(), "duplicate stage name") {
		t.Fatalf("expected duplicate name error, got %v", err)
	}
}

func TestRegistryMalformedConfig(t *testing.T) {
	r := stages.DefaultRegistry()
	_, err := r.BuildFromJSON([]byte(`{"stages":[`))
	if err == nil {
		t.Fatal("expected JSON parse error")
	}
	_, err = r.BuildFromJSON([]byte(`{"stages":[{"name":"d","type":"dedupe","config":{"keys":[]}}]}`))
	if err == nil {
		t.Fatal("expected invalid dedupe config error")
	}
}

func TestEndToEndPipeline(t *testing.T) {
	r := stages.DefaultRegistry()
	p, err := r.BuildFromJSON([]byte(`{
		"stages": [
			{"name": "validate", "type": "validate", "config": {"required": ["id"], "types": {"id": "string"}}},
			{"name": "enrich", "type": "transform", "config": {"ops": [{"op": "set", "field": "ok", "value": true}]}},
			{"name": "dedupe", "type": "dedupe", "config": {"keys": ["id"]}}
		]
	}`))
	if err != nil {
		t.Fatal(err)
	}
	res, err := p.Run(context.Background(), []pipeline.Record{
		{"id": "a"},
		{"id": "a"},
		{"name": "missing-id"},
		{"id": "b"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Dropped != 1 {
		t.Fatalf("dropped=%d", res.Dropped)
	}
	if len(res.DeadLetters) != 1 {
		t.Fatalf("dead letters=%d", len(res.DeadLetters))
	}
	if len(res.Output) != 2 {
		t.Fatalf("output=%#v", res.Output)
	}
	for _, out := range res.Output {
		if out["ok"] != true {
			t.Fatalf("transform not applied: %#v", out)
		}
	}
}
