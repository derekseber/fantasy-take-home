package stages

import "github.com/fantasy/fantasy-take-home/task1/pipeline"

// RegisterBuiltins registers validate, transform, and dedupe on r.
func RegisterBuiltins(r *pipeline.Registry) {
	r.Register("validate", NewValidateFromJSON)
	r.Register("transform", NewTransformFromJSON)
	r.Register("dedupe", NewDedupeFromJSON)
}

// DefaultRegistry returns a registry with the built-in stages registered.
func DefaultRegistry() *pipeline.Registry {
	r := pipeline.NewRegistry()
	RegisterBuiltins(r)
	return r
}
