package main

import (
	"context"
	"net/http"
	"strings"
	"time"

	voidhash "github.com/voidhashcom/voidhash-go"
)

// The shared Nimbus vocabulary. Every example — backend and app — uses these
// exact names, so one Voidhash project serves all of them.
const (
	paywallLocation       = "onboarding"
	eventNoteCreated      = "note_created"
	eventExportRequested  = "export_requested"
	attributePlan         = "plan"
	attributeNotesCreated = "notes_created"
)

type healthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	UptimeSec int64  `json:"uptimeSeconds"`
}

// handleHealth answers liveness probes without touching Voidhash, so an
// outage upstream never takes this service out of the load balancer.
func (s *server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{
		Status:    "ok",
		Service:   "nimbus-backend-go",
		UptimeSec: int64(time.Since(s.startedAt).Seconds()),
	})
}

type entitlementsView struct {
	Pro        bool                        `json:"pro"`
	Grants     []voidhash.EntitlementGrant `json:"grants"`
	ResolvedAt time.Time                   `json:"resolvedAt"`
	Stale      bool                        `json:"stale"`
}

type personAttributes struct {
	Plan         string `json:"plan"`
	NotesCreated int    `json:"notes_created"`
}

type meResponse struct {
	DistinctID   string           `json:"distinctId"`
	Known        bool             `json:"known"`
	Person       *voidhash.Person `json:"person"`
	Attributes   personAttributes `json:"attributes"`
	Entitlements entitlementsView `json:"entitlements"`
	Quota        quota            `json:"quota"`
}

// handleMe returns the person record plus their entitlement grants. A distinct
// id Voidhash has never seen is a free user with no person record, which is a
// 200 with known=false — not a 404 and certainly not a 500.
func (s *server) handleMe(w http.ResponseWriter, r *http.Request) {
	distinctID, ok := requireDistinctID(w, r)
	if !ok {
		return
	}

	access, err := s.entitlements.Access(r.Context(), distinctID)
	if err != nil {
		s.writeUpstreamError(w, err)
		return
	}

	used := s.notes.Count(distinctID)
	writeJSON(w, http.StatusOK, meResponse{
		DistinctID: distinctID,
		Known:      access.Person != nil,
		Person:     access.Person,
		Attributes: personAttributes{Plan: access.Plan(), NotesCreated: used},
		Entitlements: entitlementsView{
			Pro:        access.Pro,
			Grants:     grantsOrEmpty(access.Grants),
			ResolvedAt: access.ResolvedAt,
			Stale:      access.Stale,
		},
		Quota: newQuota(used, access.Pro),
	})
}

type notesResponse struct {
	Notes []Note `json:"notes"`
	Quota quota  `json:"quota"`
}

func (s *server) handleListNotes(w http.ResponseWriter, r *http.Request) {
	distinctID, ok := requireDistinctID(w, r)
	if !ok {
		return
	}

	access, err := s.entitlements.Access(r.Context(), distinctID)
	if err != nil {
		s.writeUpstreamError(w, err)
		return
	}

	notes := s.notes.List(distinctID)
	writeJSON(w, http.StatusOK, notesResponse{
		Notes: notes,
		Quota: newQuota(len(notes), access.Pro),
	})
}

type createNoteRequest struct {
	DistinctID string `json:"distinctId"`
	Title      string `json:"title"`
	Body       string `json:"body"`
}

type createNoteResponse struct {
	Note  Note  `json:"note"`
	Quota quota `json:"quota"`
}

// handleCreateNote enforces the free tier on the server. The client already
// knows the limit and hides the button, but the client is not the authority.
func (s *server) handleCreateNote(w http.ResponseWriter, r *http.Request) {
	var request createNoteRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	distinctID := strings.TrimSpace(request.DistinctID)
	title := strings.TrimSpace(request.Title)
	if distinctID == "" || title == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "distinctId and title are required")
		return
	}
	ctx := r.Context()

	access, err := s.entitlements.Access(ctx, distinctID)
	if err != nil {
		s.writeUpstreamError(w, err)
		return
	}

	note, total, err := s.notes.Create(distinctID, title, request.Body, access.NoteLimit())
	if err != nil {
		writePaywallError(w, http.StatusForbidden, "note_limit_reached",
			"free accounts keep 3 notes; Nimbus Pro is unlimited")
		return
	}

	s.capture(ctx, distinctID, eventNoteCreated, map[string]any{"note_id": note.ID})
	// plan and notes_created describe the person, not this one event, so they
	// are written as person traits instead of repeated on every capture.
	s.setAttributes(ctx, distinctID, map[string]any{
		attributePlan:         access.Plan(),
		attributeNotesCreated: total,
	})

	writeJSON(w, http.StatusCreated, createNoteResponse{
		Note:  note,
		Quota: newQuota(total, access.Pro),
	})
}

type exportResponse struct {
	DistinctID string    `json:"distinctId"`
	ExportedAt time.Time `json:"exportedAt"`
	Count      int       `json:"count"`
	Notes      []Note    `json:"notes"`
}

// handleExportNotes is the Pro-only route. Denials answer 402 with the paywall
// location so the client knows what to present.
func (s *server) handleExportNotes(w http.ResponseWriter, r *http.Request) {
	distinctID, ok := requireDistinctID(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	access, err := s.entitlements.Access(ctx, distinctID)
	if err != nil {
		s.writeUpstreamError(w, err)
		return
	}

	s.capture(ctx, distinctID, eventExportRequested, map[string]any{"granted": access.Pro})
	s.setAttributes(ctx, distinctID, map[string]any{attributePlan: access.Plan()})

	if !access.Pro {
		writePaywallError(w, http.StatusPaymentRequired, "premium_required",
			"exporting notes requires Nimbus Pro")
		return
	}

	notes := s.notes.List(distinctID)
	writeJSON(w, http.StatusOK, exportResponse{
		DistinctID: distinctID,
		ExportedAt: time.Now().UTC(),
		Count:      len(notes),
		Notes:      notes,
	})
}

type captureRequest struct {
	DistinctID string         `json:"distinctId"`
	Event      string         `json:"event"`
	Properties map[string]any `json:"properties"`
}

type captureResponse struct {
	Status     string `json:"status"`
	Event      string `json:"event"`
	DistinctID string `json:"distinctId"`
}

// handleCaptureEvent forwards a client-supplied analytics event. Unlike the
// captures the other routes make as a side effect, forwarding *is* the job
// here, so a failure is reported rather than swallowed.
func (s *server) handleCaptureEvent(w http.ResponseWriter, r *http.Request) {
	var request captureRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	distinctID := strings.TrimSpace(request.DistinctID)
	eventName := strings.TrimSpace(request.Event)
	if distinctID == "" || eventName == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "distinctId and event are required")
		return
	}

	if !s.analytics.Enabled() {
		writeError(w, http.StatusServiceUnavailable, "analytics_not_configured",
			"set VOIDHASH_PUBLISHABLE_KEY to forward events to Voidhash")
		return
	}
	if err := s.analytics.Capture(r.Context(), distinctID, eventName, request.Properties); err != nil {
		s.logger.Error("forwarding event failed", "event", eventName, "error", err)
		writeError(w, http.StatusBadGateway, "capture_failed", err.Error())
		return
	}

	writeJSON(w, http.StatusAccepted, captureResponse{
		Status:     "accepted",
		Event:      eventName,
		DistinctID: distinctID,
	})
}

// capture records analytics as a side effect of a business operation. A failed
// capture is logged and dropped: losing an event is far better than failing
// the note the user just wrote. A production service would hand this to a
// queue instead of blocking the request.
func (s *server) capture(ctx context.Context, distinctID, event string, properties map[string]any) {
	if !s.analytics.Enabled() {
		return
	}
	if err := s.analytics.Capture(ctx, distinctID, event, properties); err != nil {
		s.logger.Warn("capturing event failed", "event", event, "error", err)
	}
}

// setAttributes records person traits as a side effect of a business
// operation, with the same best-effort contract as capture. Unlike capture it
// needs no publishable key, so it runs even when analytics is switched off.
func (s *server) setAttributes(ctx context.Context, distinctID string, traits map[string]any) {
	if err := s.analytics.SetAttributes(ctx, distinctID, traits); err != nil {
		s.logger.Warn("writing person attributes failed", "distinctId", distinctID, "error", err)
	}
}

// grantsOrEmpty keeps the JSON field an array rather than null when a person
// holds nothing.
func grantsOrEmpty(grants []voidhash.EntitlementGrant) []voidhash.EntitlementGrant {
	if grants == nil {
		return []voidhash.EntitlementGrant{}
	}
	return grants
}
