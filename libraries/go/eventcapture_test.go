package voidhash_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/voidhashcom/voidhash-go"
)

// newIngestClient points a client's ingestion base at a test server; the
// management base URL is irrelevant for capture.
func newIngestClient(t *testing.T, handler http.Handler, opts ...voidhash.Option) *voidhash.Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	client, err := voidhash.New("vh_sk_test", append([]voidhash.Option{voidhash.WithIngestURL(server.URL)}, opts...)...)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	return client
}

func TestCaptureSendsSecretKeyAndWireFields(t *testing.T) {
	var (
		gotPath string
		gotKey  string
		gotBody map[string]any
	)
	client := newIngestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotKey = r.Header.Get("x-secret-key")
		payload, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(payload, &gotBody); err != nil {
			t.Errorf("request body is not JSON: %v", err)
		}
		if _, hasToken := gotBody["token"]; hasToken {
			t.Error("body must not carry a publishable token")
		}
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]int{"accepted": 1, "rejected": 0})
	}))

	result, err := client.EventCapture.Capture(context.Background(), voidhash.Event{
		Event:      "paywall_viewed",
		DistinctID: "user_123",
	})
	if err != nil {
		t.Fatalf("Capture() error: %v", err)
	}

	if result.Accepted != 1 || result.Rejected != 0 {
		t.Errorf("result = %+v, want accepted 1 rejected 0", result)
	}
	if gotPath != "/i/v1/capture" {
		t.Errorf("path = %q, want /i/v1/capture", gotPath)
	}
	if gotKey != "vh_sk_test" {
		t.Errorf("x-secret-key = %q, want vh_sk_test", gotKey)
	}
	for _, field := range []string{"uuid", "event", "distinct_id", "properties", "context", "sent_at"} {
		if _, ok := gotBody[field]; !ok {
			t.Errorf("body is missing required field %q: %v", field, gotBody)
		}
	}
	if gotBody["uuid"] == "" {
		t.Error("uuid must be generated when the caller leaves it empty")
	}
	if gotBody["event"] != "paywall_viewed" || gotBody["distinct_id"] != "user_123" {
		t.Errorf("unexpected body: %v", gotBody)
	}
	if _, ok := gotBody["properties"].(map[string]any); !ok {
		t.Errorf("properties = %v, want an object", gotBody["properties"])
	}
	if _, ok := gotBody["context"].(map[string]any); !ok {
		t.Errorf("context = %v, want an object", gotBody["context"])
	}
	if _, ok := gotBody["session_id"]; ok {
		t.Error("session_id must be omitted when empty")
	}
	if _, ok := gotBody["timestamp"]; ok {
		t.Error("timestamp must be omitted when unset")
	}
	sentAt, ok := gotBody["sent_at"].(string)
	if !ok {
		t.Fatalf("sent_at = %v, want a string", gotBody["sent_at"])
	}
	if _, err := time.Parse(time.RFC3339, sentAt); err != nil {
		t.Errorf("sent_at %q is not ISO 8601: %v", sentAt, err)
	}
}

func TestCapturePreservesCallerSuppliedFields(t *testing.T) {
	var gotBody map[string]any
	client := newIngestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusAccepted)
	}))

	occurredAt := time.Date(2026, 8, 22, 12, 0, 0, 0, time.UTC)
	_, err := client.EventCapture.Capture(context.Background(), voidhash.Event{
		UUID:       "018f6d2e-4c3a-7b1d-9e5f-2a8c1b0d4e6f",
		Event:      "purchase_completed",
		DistinctID: "user_123",
		Properties: map[string]any{"product_id": "pro_monthly"},
		Context:    map[string]any{"app_version": "1.2.3"},
		SessionID:  "sess_1",
		Timestamp:  &occurredAt,
	})
	if err != nil {
		t.Fatalf("Capture() error: %v", err)
	}

	if gotBody["uuid"] != "018f6d2e-4c3a-7b1d-9e5f-2a8c1b0d4e6f" {
		t.Errorf("uuid = %v, want the caller-supplied value", gotBody["uuid"])
	}
	if gotBody["session_id"] != "sess_1" {
		t.Errorf("session_id = %v", gotBody["session_id"])
	}
	if gotBody["timestamp"] != "2026-08-22T12:00:00Z" {
		t.Errorf("timestamp = %v", gotBody["timestamp"])
	}
	properties, _ := gotBody["properties"].(map[string]any)
	if properties["product_id"] != "pro_monthly" {
		t.Errorf("properties = %v", gotBody["properties"])
	}
	eventContext, _ := gotBody["context"].(map[string]any)
	if eventContext["app_version"] != "1.2.3" {
		t.Errorf("context = %v", gotBody["context"])
	}
}

func TestCaptureBatchPostsAllEvents(t *testing.T) {
	var (
		gotPath string
		gotBody map[string]any
	)
	client := newIngestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]int{"accepted": 2, "rejected": 0})
	}))

	result, err := client.EventCapture.CaptureBatch(context.Background(), []voidhash.Event{
		{Event: "paywall_viewed", DistinctID: "user_1"},
		{Event: "paywall_dismissed", DistinctID: "user_2"},
	})
	if err != nil {
		t.Fatalf("CaptureBatch() error: %v", err)
	}

	if result.Accepted != 2 || result.Rejected != 0 {
		t.Errorf("result = %+v, want accepted 2 rejected 0", result)
	}
	if gotPath != "/i/v1/batch" {
		t.Errorf("path = %q, want /i/v1/batch", gotPath)
	}
	if _, ok := gotBody["sent_at"].(string); !ok {
		t.Errorf("sent_at = %v, want a request-level string", gotBody["sent_at"])
	}
	events, ok := gotBody["events"].([]any)
	if !ok || len(events) != 2 {
		t.Fatalf("events = %v, want 2 entries", gotBody["events"])
	}
	seen := map[string]bool{}
	for _, entry := range events {
		event, _ := entry.(map[string]any)
		if _, hasSentAt := event["sent_at"]; hasSentAt {
			t.Error("per-event sent_at must not be sent in a batch")
		}
		uuid, _ := event["uuid"].(string)
		if uuid == "" {
			t.Errorf("event %v is missing a generated uuid", event)
		}
		if seen[uuid] {
			t.Errorf("uuid %q reused across events in a batch", uuid)
		}
		seen[uuid] = true
		name, _ := event["event"].(string)
		if name == "" || event["distinct_id"] == "" {
			t.Errorf("unexpected event: %v", event)
		}
	}
}

func TestCaptureBatchSkipsEmptySlice(t *testing.T) {
	called := false
	client := newIngestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusAccepted)
	}))

	result, err := client.EventCapture.CaptureBatch(context.Background(), nil)
	if err != nil {
		t.Fatalf("CaptureBatch(nil) error: %v", err)
	}
	if result.Accepted != 0 || result.Rejected != 0 {
		t.Errorf("result = %+v, want an empty result", result)
	}
	if called {
		t.Error("expected no request for an empty batch")
	}
}

func TestCaptureMapsErrorResponse(t *testing.T) {
	client := newIngestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"_tag":"CaptureUnauthorizedError","code":"unauthorized","error":"invalid key"}`))
	}))

	_, err := client.EventCapture.Capture(context.Background(), voidhash.Event{
		Event:      "paywall_viewed",
		DistinctID: "user_123",
	})
	if err == nil {
		t.Fatal("expected an error")
	}
	apiErr, ok := err.(*voidhash.APIError)
	if !ok {
		t.Fatalf("expected *APIError, got %T", err)
	}
	if apiErr.StatusCode != http.StatusUnauthorized {
		t.Errorf("StatusCode = %d, want 401", apiErr.StatusCode)
	}
	if apiErr.Tag != "CaptureUnauthorizedError" {
		t.Errorf("Tag = %q", apiErr.Tag)
	}
	if apiErr.Body != "invalid key" {
		t.Errorf("Body = %q, want the server error message", apiErr.Body)
	}
}

func TestCaptureSendsThePublishableKeyAsTheBodyTokenWhenConfigured(t *testing.T) {
	var (
		gotKey  string
		gotBody map[string]any
	)
	client := newIngestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("x-secret-key")
		json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]int{"accepted": 1, "rejected": 0})
	}), voidhash.WithPublishableKey("vh_pk_test"))

	if _, err := client.EventCapture.Capture(context.Background(), voidhash.Event{
		Event:      "paywall_viewed",
		DistinctID: "user_123",
	}); err != nil {
		t.Fatalf("Capture() error: %v", err)
	}

	if gotKey != "vh_sk_test" {
		t.Errorf("x-secret-key = %q, want vh_sk_test", gotKey)
	}
	if gotBody["token"] != "vh_pk_test" {
		t.Errorf("token = %v, want vh_pk_test", gotBody["token"])
	}
}
