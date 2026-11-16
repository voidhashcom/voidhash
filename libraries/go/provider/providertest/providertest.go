// Package providertest sends correctly signed requests to a provider.Handler,
// for unit tests of a payment source's provider endpoint.
//
//	resp := providertest.Call(h, "catalog.list", map[string]any{"cursor": nil})
//	// resp.StatusCode == 200; the body is {"id": ..., "result": {...}}
package providertest

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"time"

	"github.com/voidhashcom/voidhash-go/internal/signature"
	"github.com/voidhashcom/voidhash-go/provider"
	"github.com/voidhashcom/voidhash-go/provider/internal/credentials"
)

// RequestID is the id every request built here carries.
const RequestID = "preq_test"

// Option adjusts a request built by [NewRequest] or [Call].
type Option func(*options)

type options struct {
	environment provider.Environment
}

// WithEnvironment sends the request for an environment; the default is
// production. A provider_error carries the implementation's own message only
// in the test environment.
func WithEnvironment(environment provider.Environment) Option {
	return func(o *options) { o.environment = environment }
}

// NewRequest builds a request for the operation with the given input, signed
// for h's source and secret at the current time, the way Voidhash sends it.
// It panics when input cannot be encoded as JSON, like httptest.NewRequest
// panics on a bad request.
func NewRequest(h *provider.Handler, operation string, input any, opts ...Option) *http.Request {
	o := options{environment: provider.EnvironmentProduction}
	for _, opt := range opts {
		opt(&o)
	}
	source, secret := credentials.Of(h)
	body, err := json.Marshal(map[string]any{
		"protocolVersion": 1,
		"id":              RequestID,
		"source":          source,
		"environment":     o.environment,
		"operation":       operation,
		"input":           input,
	})
	if err != nil {
		panic("providertest: encoding input: " + err.Error())
	}
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-voidhash-timestamp", timestamp)
	req.Header.Set("x-voidhash-signature", signature.Sign(body, timestamp, secret))
	return req
}

// Call sends a request built by [NewRequest] through h and returns the
// response. Its body is `{"id", "result"}` on success and `{"id", "error":
// {"code", "message"}}` otherwise.
func Call(h *provider.Handler, operation string, input any, opts ...Option) *http.Response {
	recorder := httptest.NewRecorder()
	h.ServeHTTP(recorder, NewRequest(h, operation, input, opts...))
	return recorder.Result()
}
