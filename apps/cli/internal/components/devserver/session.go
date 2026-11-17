package devserver

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/voidhashcom/voidhash/apps/cli/internal/components/definition"
)

// HeartbeatInterval is how often a run reports while nothing changes; a
// session expires 30 seconds after its last report.
const HeartbeatInterval = 10 * time.Second

// ChangeReportDelay is how long after a change a run reports it.
const ChangeReportDelay = 500 * time.Millisecond

// endTimeout is how long ending the session may hold up the end of a run.
const endTimeout = 2 * time.Second

// ReportedBuild is the build of a component as a session reports it.
type ReportedBuild struct {
	State   string  `json:"state"`
	Message *string `json:"message,omitempty"`
}

// ReportedComponent is a component as a session reports it: its status
// entry without the build log, the panel manifest and the URLs.
type ReportedComponent struct {
	Slug             string        `json:"slug"`
	DefinitionID     string        `json:"definitionId"`
	Title            string        `json:"title"`
	Origin           string        `json:"origin"`
	BaseVersion      *int          `json:"baseVersion,omitempty"`
	PublishedVersion *int          `json:"publishedVersion,omitempty"`
	IsModified       bool          `json:"isModified"`
	IsConflicted     bool          `json:"isConflicted"`
	Build            ReportedBuild `json:"build"`
	ModuleHash       *string       `json:"moduleHash,omitempty"`
	PanelHash        *string       `json:"panelHash,omitempty"`
	// Definition is the definition of the last successful build.
	Definition *definition.Definition `json:"definition,omitempty"`
}

// ReportedComponents are the components of a session, from the status.
func ReportedComponents(status Status) []ReportedComponent {
	reported := make([]ReportedComponent, len(status.Components))
	for index, component := range status.Components {
		entry := ReportedComponent{
			Slug:             component.Slug,
			DefinitionID:     component.DefinitionID,
			Title:            component.Title,
			Origin:           component.Origin,
			BaseVersion:      component.BaseVersion,
			PublishedVersion: component.PublishedVersion,
			IsModified:       component.IsModified,
			IsConflicted:     component.IsConflicted,
			Build:            ReportedBuild{State: component.Build.State, Message: component.Build.Message},
		}
		if built := component.Component; built != nil {
			entry.ModuleHash = &built.Module.Hash
			if built.Panel != nil {
				entry.PanelHash = &built.Panel.Hash
			}
			entry.Definition = built.Definition
		}
		reported[index] = entry
	}
	return reported
}

// Fingerprint identifies what a session would report for the status, so a
// run reports only when it changed.
func Fingerprint(status Status) string {
	encoded, _ := json.Marshal(ReportedComponents(status))
	return string(encoded)
}

// CallError is a dev session call that failed.
type CallError struct {
	// Status is the HTTP status of the answer; 0 when the request never got
	// an answer.
	Status int
	// Message says what failed, for a person.
	Message string
	// Err is the failure as the API client reported it.
	Err error
}

func (e *CallError) Error() string { return e.Message }
func (e *CallError) Unwrap() error { return e.Err }

// SessionAPI makes the dev session calls of a run for one project. A failed
// call returns a [*CallError].
type SessionAPI interface {
	Create(ctx context.Context, url, token string, components []ReportedComponent) (id string, err error)
	Update(ctx context.Context, id string, components []ReportedComponent) error
	Delete(ctx context.Context, id string) error
	// ListIDs lists the ids of the person's active sessions in the project.
	ListIDs(ctx context.Context) ([]string, error)
}

// FailureKind says what a failed report means: the session no longer exists
// ("gone", only for a refresh), the run cannot report at all ("fatal":
// signed out, or not allowed to), or Voidhash cannot be reached right now
// ("transient"). call is "register" or "update"; status is 0 when the
// request never got an answer.
func FailureKind(call string, status int) string {
	switch {
	case status == 0:
		return "transient"
	case call == "update" && status == 404:
		return "gone"
	case status == 401 || status == 403:
		return "fatal"
	case call == "register" && status == 404:
		return "fatal"
	}
	return "transient"
}

// AfterSessionGone says what a run whose session is gone does: stop when
// another session of the person in the project is active (another run took
// over, "taken-over"), or "register" again (the session expired, for example
// while the computer slept).
func AfterSessionGone(activeSessionIDs []string, ownSessionID string) string {
	for _, id := range activeSessionIDs {
		if id != ownSessionID {
			return "taken-over"
		}
	}
	return "register"
}

// TakenOverMessage is the message a run stops with when another run took
// its session.
const TakenOverMessage = "Another voidhash dev took over this project, so this one stopped. Only one run per project reaches the paywall editor."

// ErrTakenOver ends a run whose session another run took.
var ErrTakenOver = errors.New(TakenOverMessage)

// Reporter makes a run's reports to its dev session.
type Reporter struct {
	// API makes the calls.
	API SessionAPI
	// URL is the server's origin, http://127.0.0.1:<port>.
	URL   string
	Token string
	// Components reads what to report.
	Components func() []ReportedComponent
	// Log prints a line of progress; Warn prints a warning.
	Log  func(line string)
	Warn func(line string)

	sessionID string
	warning   string
}

func callError(err error) *CallError {
	var failed *CallError
	if errors.As(err, &failed) {
		return failed
	}
	return &CallError{Message: err.Error(), Err: err}
}

func (r *Reporter) warnOnce(message string) {
	if r.warning == message {
		return
	}
	r.warning = message
	r.Warn("Could not reach Voidhash to report the dev session (" + message + "); retrying. The local server keeps running.")
}

// reached notes the end of an outage that a warning reported.
func (r *Reporter) reached() {
	if r.warning == "" {
		return
	}
	r.warning = ""
	r.Log("✓ Reaching Voidhash again; the dev session is up to date.")
}

// failed returns the error to stop the run with, or nil after a warning.
func (r *Reporter) failed(ctx context.Context, call string, err error) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	failure := callError(err)
	if FailureKind(call, failure.Status) == "fatal" {
		return failure
	}
	r.warnOnce(failure.Message)
	return nil
}

func (r *Reporter) register(ctx context.Context) error {
	id, err := r.API.Create(ctx, r.URL, r.Token, r.Components())
	if err != nil {
		return r.failed(ctx, "register", err)
	}
	r.sessionID = id
	r.Log("✓ Registered the dev session: your paywall editor picks these builds up on its own.")
	r.reached()
	return nil
}

// Report registers the session, or refreshes it with the current
// components. It fails only when the run must stop: with [ErrTakenOver],
// with the [*CallError] of a call the run may not make, or with the
// context's error. Voidhash being out of reach prints a warning once, and
// the next report tries again.
func (r *Reporter) Report(ctx context.Context) error {
	if r.sessionID == "" {
		return r.register(ctx)
	}
	err := r.API.Update(ctx, r.sessionID, r.Components())
	if err == nil {
		r.reached()
		return nil
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if FailureKind("update", callError(err).Status) != "gone" {
		return r.failed(ctx, "update", err)
	}
	// A person has at most one session per project, so the first page holds it.
	active, err := r.API.ListIDs(ctx)
	if err != nil {
		return r.failed(ctx, "update", err)
	}
	own := r.sessionID
	r.sessionID = ""
	if AfterSessionGone(active, own) == "taken-over" {
		return ErrTakenOver
	}
	return r.register(ctx)
}

// End ends the session, if there is one. It may be called after the run's
// context ended, and holds the end of the run up for two seconds at most.
func (r *Reporter) End(ctx context.Context) {
	if r.sessionID == "" {
		return
	}
	ending, cancel := context.WithTimeout(context.WithoutCancel(ctx), endTimeout)
	defer cancel()
	err := r.API.Delete(ending, r.sessionID)
	if err == nil {
		return
	}
	reason := callError(err).Message
	if ending.Err() != nil {
		reason = "Voidhash did not answer in time"
	}
	r.Warn("Could not end the dev session (" + reason + "); it expires on its own within 30 seconds.")
}
