package main

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	voidhash "github.com/voidhashcom/voidhash-go"
)

// maxRequestBody caps client request bodies. Nimbus notes are text.
const maxRequestBody = 64 << 10

// server holds everything the handlers need. Nothing here is global, so a test
// can stand up a second one against a stub.
type server struct {
	client        *voidhash.Client
	analytics     *analyticsClient
	notes         *noteStore
	entitlements  *entitlementCache
	deliveries    *dedupeSet
	logger        *slog.Logger
	webhookSecret string
	configBaseURL string
	startedAt     time.Time
}

func newServer(client *voidhash.Client, cfg config, logger *slog.Logger) *server {
	return &server{
		client:        client,
		analytics:     newAnalyticsClient(client, logger),
		notes:         newNoteStore(),
		entitlements:  newEntitlementCache(client, logger, entitlementTTL),
		deliveries:    newDedupeSet(dedupeWindow),
		logger:        logger,
		webhookSecret: cfg.WebhookSecret,
		configBaseURL: cfg.BaseURL,
		startedAt:     time.Now(),
	}
}

// baseURL is the Voidhash management API this server talks to.
func (s *server) baseURL() string {
	if s.configBaseURL != "" {
		return s.configBaseURL
	}
	return voidhash.DefaultBaseURL
}

// routes wires the Nimbus HTTP surface. Method-qualified patterns need Go 1.22.
func (s *server) routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /v1/me", s.handleMe)
	mux.HandleFunc("GET /v1/notes", s.handleListNotes)
	mux.HandleFunc("POST /v1/notes", s.handleCreateNote)
	mux.HandleFunc("GET /v1/notes/export", s.handleExportNotes)
	mux.HandleFunc("POST /v1/events", s.handleCaptureEvent)
	mux.HandleFunc("POST /webhooks/voidhash", s.handleWebhook)
	mux.HandleFunc("/", s.handleNotFound)

	return s.withRequestLog(mux)
}

func (s *server) withRequestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		s.logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.status,
			"durationMs", time.Since(started).Milliseconds(),
		)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

// errorResponse is the body of every 4xx and 5xx. Error is a stable machine
// code — clients branch on it, not on Message.
type errorResponse struct {
	Error   string       `json:"error"`
	Message string       `json:"message"`
	Paywall *paywallHint `json:"paywall,omitempty"`
}

// paywallHint tells the client which paywall location to present. Every Nimbus
// upsell lives at the `onboarding` location.
type paywallHint struct {
	Location string `json:"location"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Default().Error("writing response", "error", err)
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{Error: code, Message: message})
}

func writePaywallError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{
		Error:   code,
		Message: message,
		Paywall: &paywallHint{Location: paywallLocation},
	})
}

// writeUpstreamError maps a Voidhash failure onto a status the client can act
// on. The distinction that matters: a 503 says "ask again", a 500 says "this
// project is misconfigured and retrying will not help".
func (s *server) writeUpstreamError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errPerkNotConfigured):
		s.logger.Error("voidhash project is misconfigured", "error", err)
		writeError(w, http.StatusInternalServerError, "perk_not_configured", err.Error())
	case isUnknownFailure(err):
		s.logger.Error("voidhash is unreachable", "error", err)
		writeError(w, http.StatusServiceUnavailable, "entitlements_unavailable",
			"could not reach Voidhash and no cached answer is available for this person")
	default:
		s.logger.Error("voidhash rejected the request", "error", err, "status", voidhash.StatusCode(err))
		writeError(w, http.StatusBadGateway, "upstream_error", err.Error())
	}
}

// decodeJSON reads a size-capped JSON body into dst, reporting a client-safe
// message on failure.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRequestBody))
	if err := decoder.Decode(dst); err != nil {
		return errors.New("request body must be a JSON object")
	}
	return nil
}

// requireDistinctID reads the caller's distinct id from the query string,
// writing a 400 and reporting false when it is absent.
func requireDistinctID(w http.ResponseWriter, r *http.Request) (string, bool) {
	distinctID := strings.TrimSpace(r.URL.Query().Get("distinctId"))
	if distinctID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "distinctId query parameter is required")
		return "", false
	}
	return distinctID, true
}

func (s *server) handleNotFound(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotFound, "not_found", r.Method+" "+r.URL.Path+" is not a Nimbus route")
}
