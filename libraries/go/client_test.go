package voidhash_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
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
