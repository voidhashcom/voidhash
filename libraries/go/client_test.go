package voidhash_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/voidhashcom/voidhash-go"
)

func newTestClient(t *testing.T, handler http.Handler) (*voidhash.Client, *httptest.Server) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	client, err := voidhash.New("vh_sk_test", voidhash.WithBaseURL(server.URL))
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	return client, server
}

func TestNewRejectsEmptySecretKey(t *testing.T) {
	if _, err := voidhash.New(""); err == nil {
		t.Fatal("expected error for empty secret key")
	}
}

func TestGetPersonByDistinctIDSendsAuthHeader(t *testing.T) {
	var gotKey string
	client, _ := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("x-secret-key")
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"personId":   "per_1",
			"distinctId": "user-123",
		})
	}))

	person, err := client.Persons.GetByDistinctID(context.Background(), "user-123")
	if err != nil {
		t.Fatalf("GetByDistinctID() error: %v", err)
	}
	if gotKey != "vh_sk_test" {
		t.Errorf("x-secret-key = %q, want vh_sk_test", gotKey)
	}
	if person.PersonId != "per_1" || person.DistinctId != "user-123" {
		t.Errorf("unexpected person: %+v", person)
	}
}

func TestErrorMapping(t *testing.T) {
	client, _ := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"_tag":"Api/PersonNotFoundError","id":"per_missing"}`))
	}))

	_, err := client.Persons.Get(context.Background(), "per_missing")
	apiErr := &voidhash.APIError{}
	if err == nil {
		t.Fatal("expected an error")
	}
	if e, ok := err.(*voidhash.APIError); ok {
		apiErr = e
	} else {
		t.Fatalf("expected *APIError, got %T", err)
	}
	if !voidhash.IsNotFound(err) || voidhash.StatusCode(err) != 404 {
		t.Errorf("IsNotFound/StatusCode wrong: %v", err)
	}
	if apiErr.Tag != "Api/PersonNotFoundError" {
		t.Errorf("Tag = %q", apiErr.Tag)
	}
}

func TestHasActivePerkByIDAndSlug(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/persons/by-distinct-id/user-1", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"personId": "per_1", "distinctId": "user-1"})
	})
	mux.HandleFunc("/api/v1/persons/per_1/entitlements", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"grants": []map[string]any{{
				"perkId":         "perk_pro",
				"status":         "active",
				"expiresAt":      nil,
				"source":         "subscription",
				"sourceId":       nil,
				"sourcePersonId": "per_1",
			}},
		})
	})
	mux.HandleFunc("/api/v1/perks", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode([]map[string]string{
			{"id": "perk_free", "name": "Free", "projectId": "prj_1", "slug": "free"},
			{"id": "perk_pro", "name": "Pro", "projectId": "prj_1", "slug": "pro"},
		})
	})

	client, _ := newTestClient(t, mux)

	active, err := client.Persons.Entitlements.HasActivePerk(context.Background(), voidhash.HasActivePerkParams{
		DistinctID: "user-1",
		PerkSlug:   "pro",
	})
	if err != nil || !active {
		t.Errorf("HasActivePerk(pro) = %v, %v; want true, nil", active, err)
	}

	inactive, err := client.Persons.Entitlements.HasActivePerk(context.Background(), voidhash.HasActivePerkParams{
		DistinctID: "user-1",
		PerkSlug:   "free",
	})
	if err != nil || inactive {
		t.Errorf("HasActivePerk(free) = %v, %v; want false, nil", inactive, err)
	}

	if _, err := client.Persons.Entitlements.HasActivePerk(context.Background(), voidhash.HasActivePerkParams{
		DistinctID: "user-1",
	}); err == nil {
		t.Error("expected configuration error when neither perk selector is set")
	}
}

func signWebhook(t *testing.T, timestamp string, payload []byte, secret string) string {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(payload)
	return "v1=" + hex.EncodeToString(mac.Sum(nil))
}

func TestConstructWebhookEvent(t *testing.T) {
	payload := []byte(`{"hello":"world"}`)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature := signWebhook(t, timestamp, payload, "whsec_test")

	event, err := voidhash.ConstructWebhookEvent(payload, http.Header{
		"X-Webhook-Event":     []string{"purchase.completed"},
		"X-Webhook-Timestamp": []string{timestamp},
		"X-Webhook-Signature": []string{signature},
	}, "whsec_test")
	if err != nil {
		t.Fatalf("ConstructWebhookEvent() error: %v", err)
	}
	if event.Type != "purchase.completed" {
		t.Errorf("Type = %q", event.Type)
	}
	if string(event.Payload) != `{"hello":"world"}` {
		t.Errorf("Payload = %s", event.Payload)
	}

	badSignature := signature[:len(signature)-4] + "0000"
	headers := http.Header{
		"X-Webhook-Event":     []string{"purchase.completed"},
		"X-Webhook-Timestamp": []string{timestamp},
		"X-Webhook-Signature": []string{badSignature},
	}
	if _, err := voidhash.ConstructWebhookEvent(payload, headers, "whsec_test"); err == nil {
		t.Error("expected verification failure for tampered signature")
	}
}

func TestCaptureSendsTheIngestContractWithThePublishableKey(t *testing.T) {
	var (
		gotPath      string
		gotSecretKey string
		gotBody      map[string]any
	)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotSecretKey = r.Header.Get("x-secret-key")
		json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]int{"accepted": 1, "rejected": 0})
	}))
	t.Cleanup(server.Close)

	client, err := voidhash.New("vh_sk_test",
		voidhash.WithIngestURL(server.URL),
		voidhash.WithPublishableKey("vh_pk_test"),
	)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	result, err := client.EventCapture.Capture(context.Background(), voidhash.Event{
		Event:      "note_created",
		DistinctID: "user-123",
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
	// Ingest authenticates on the body token; the secret key must not leak
	// onto this origin.
	if gotSecretKey != "" {
		t.Errorf("x-secret-key = %q, want it absent", gotSecretKey)
	}
	if gotBody["event"] != "note_created" || gotBody["distinct_id"] != "user-123" {
		t.Errorf("unexpected body: %+v", gotBody)
	}
	if gotBody["token"] != "vh_pk_test" {
		t.Errorf("token = %v, want vh_pk_test", gotBody["token"])
	}
	if gotBody["uuid"] == "" || gotBody["sent_at"] == "" {
		t.Errorf("uuid and sent_at must be set: %+v", gotBody)
	}
	// Both must decode as JSON objects; a null or array is rejected with a 400.
	for _, field := range []string{"context", "properties"} {
		if _, ok := gotBody[field].(map[string]any); !ok {
			t.Errorf("%s = %#v, want an object", field, gotBody[field])
		}
	}
}

func TestCaptureWithoutAPublishableKeyIsAConfigurationError(t *testing.T) {
	client, err := voidhash.New("vh_sk_test")
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	if _, err := client.EventCapture.Capture(context.Background(), voidhash.Event{
		Event:      "note_created",
		DistinctID: "user-123",
	}); !errors.Is(err, voidhash.ErrPublishableKeyRequired) {
		t.Errorf("Capture() error = %v, want ErrPublishableKeyRequired", err)
	}
}

func TestSetAttributesPostsTraitsForTheNamedPerson(t *testing.T) {
	var (
		gotPath string
		gotBody map[string]any
	)
	client, _ := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"personId":   "per_1",
			"distinctId": "user-123",
		})
	}))

	person, err := client.Persons.SetAttributes(context.Background(), voidhash.SetPersonAttributesParams{
		DistinctID: "user-123",
		Traits:     map[string]any{"plan": "pro"},
	})
	if err != nil {
		t.Fatalf("SetAttributes() error: %v", err)
	}

	if person.PersonId != "per_1" {
		t.Errorf("personId = %q, want per_1", person.PersonId)
	}
	if gotPath != "/api/v1/persons/attributes" {
		t.Errorf("path = %q, want /api/v1/persons/attributes", gotPath)
	}
	if gotBody["distinctId"] != "user-123" {
		t.Errorf("distinctId = %v, want user-123", gotBody["distinctId"])
	}
	if traits, ok := gotBody["traits"].(map[string]any); !ok || traits["plan"] != "pro" {
		t.Errorf("traits = %#v, want plan=pro", gotBody["traits"])
	}
}
