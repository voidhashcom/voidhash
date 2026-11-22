package cli

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/voidhashcom/voidhash-go"
	"github.com/voidhashcom/voidhash/apps/cli/internal/prompt"
)

// The exit codes scripts can rely on. Every failure the CLI reports exits
// with one of these.
const (
	// ExitOK: the command did what it was asked, or printed help.
	ExitOK = 0
	// ExitFailure: the command failed.
	ExitFailure = 1
	// ExitUsage: the command was used wrongly: a missing or ambiguous
	// argument, an invalid flag, a request the API rejected as invalid, or a
	// confirmation it needs but cannot ask for.
	ExitUsage = 2
	// ExitUnauthenticated: no one is signed in, or the API no longer accepts
	// the stored credential.
	ExitUnauthenticated = 3
	// ExitNotFound: what the command names does not exist, or the credential
	// cannot see it.
	ExitNotFound = 4
	// ExitInterrupted: the person stopped the command, as with Ctrl+C.
	ExitInterrupted = 130
)

// UserError is a failure the CLI shows the person and exits with. Say what
// happened and why in Message, and put the next thing to do, usually a
// command to run, in Hint. The CLI prints them as "error: …" and "hint: …"
// on standard error and exits with ExitCode ([ExitFailure] when zero).
//
//	return &cli.UserError{
//		Message:  fmt.Sprintf("No product is named %q.", input),
//		Hint:     "'voidhash product list' shows them.",
//		ExitCode: cli.ExitNotFound,
//	}
type UserError struct {
	Message  string
	Hint     string
	ExitCode int
	// Cause is the underlying error, shown with --debug.
	Cause error
}

// Error implements the error interface.
func (e *UserError) Error() string { return e.Message }

// Unwrap returns the underlying error.
func (e *UserError) Unwrap() error { return e.Cause }

// Line is the message and hint on one line, for a command that reports
// several failures together.
func (e *UserError) Line() string {
	return strings.Join(strings.Fields(e.Message+" "+e.Hint), " ")
}

// Failf is a failure that exits with [ExitFailure] and has no hint.
func Failf(format string, args ...any) *UserError {
	return &UserError{Message: fmt.Sprintf(format, args...)}
}

// Usagef is a failure for a command used wrongly, which exits with
// [ExitUsage].
func Usagef(format string, args ...any) *UserError {
	return &UserError{Message: fmt.Sprintf(format, args...), ExitCode: ExitUsage}
}

// WithHint returns the error with hint as its next step.
func (e *UserError) WithHint(hint string) *UserError {
	e.Hint = hint
	return e
}

// transportError is a request that got no answer from the API.
type transportError struct {
	url string
	err error
}

func (e *transportError) Error() string { return e.err.Error() }
func (e *transportError) Unwrap() error { return e.err }

// errorType is what an API error `type` tells the person to do next, and
// the exit code it ends in.
type errorType struct {
	hint       string
	exitCode   int
	unexpected bool
}

var errorTypes = map[string]errorType{
	"invalid_request": {exitCode: ExitUsage},
	"unauthenticated": {hint: "Sign in again with 'voidhash login'.", exitCode: ExitUnauthenticated},
	"permission_denied": {
		hint:     "Your role cannot do this here, or the CLI is read-only on this computer; 'voidhash whoami' shows which.",
		exitCode: ExitFailure,
	},
	"not_found":    {exitCode: ExitNotFound},
	"conflict":     {exitCode: ExitFailure},
	"rate_limited": {hint: "Wait a moment, then try again.", exitCode: ExitFailure},
	"unavailable": {
		hint:       "This Voidhash server cannot do this right now. Try again later.",
		exitCode:   ExitFailure,
		unexpected: true,
	},
	"internal": {
		hint:       "This is a problem on our side. If it keeps happening, contact support with the request id.",
		exitCode:   ExitFailure,
		unexpected: true,
	},
}

// ExitCodeForStatus is the exit code an HTTP status without an error
// envelope ends in.
func ExitCodeForStatus(status int) int {
	switch status {
	case 400:
		return ExitUsage
	case 401:
		return ExitUnauthenticated
	case 404:
		return ExitNotFound
	default:
		return ExitFailure
	}
}

// IsAPIError reports whether err is a call the API refused or that could
// not reach it.
func IsAPIError(err error) bool {
	var apiErr *voidhash.APIError
	var transport *transportError
	return errors.As(err, &apiErr) || errors.As(err, &transport)
}

// APIErrorCode is the error `code` the API answered with, such as
// "product_slug_taken", for a command that handles one failure itself. It
// is empty when err is not an API error.
func APIErrorCode(err error) string {
	var apiErr *voidhash.APIError
	if errors.As(err, &apiErr) {
		return apiErr.Code
	}
	return ""
}

// APIErrorStatus is the HTTP status of a failed API call; 0 when err is not
// an API error.
func APIErrorStatus(err error) int {
	var apiErr *voidhash.APIError
	if errors.As(err, &apiErr) {
		return apiErr.StatusCode
	}
	return 0
}

// APIErrorType is the error `type` the API answered with, such as
// "not_found" or "permission_denied"; empty when err is not an API error.
func APIErrorType(err error) string {
	var apiErr *voidhash.APIError
	if errors.As(err, &apiErr) {
		return apiErr.Type
	}
	return ""
}

// IfPermitted is for the parts of a combined view a person may not see: it
// reports ok false, without an error, when err says the caller's access does
// not include the call (permission_denied), so the command can show what it
// may and say what is not shown.
//
//	settings, err := cli.Fetch[api.Settings](ctx, app, …)
//	if ok, err := cli.IfPermitted(err); err != nil {
//		return err
//	} else if ok {
//		… show settings.Value …
//	}
func IfPermitted(err error) (ok bool, rest error) {
	if err == nil {
		return true, nil
	}
	if APIErrorCode(err) == "permission_denied" {
		return false, nil
	}
	return false, err
}

// APIError turns a failed API call into what the person reads: the API's
// own message (written for people), the next step its error `type`
// suggests, and the request id when the failure is unexpected. It exits
// with the code the type maps to (unauthenticated 3, not_found 4,
// invalid_request 2, the rest 1). An err that is not an API error is
// returned as it is, and nil stays nil.
//
// hints replaces the next step for specific error codes when the command
// knows a better one:
//
//	err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
//		return c.ProductsDelete(ctx, projectID, product.Id)
//	})
//	return cli.APIError(err, map[string]string{
//		"product_in_use": "Remove its store products first: 'voidhash open product pro'.",
//	})
//
// A command that adds nothing need not call this at all: the CLI renders
// every failure a command returns unhandled the same way.
func APIError(err error, hints map[string]string) error {
	if err == nil {
		return nil
	}
	var transport *transportError
	if errors.As(err, &transport) {
		return &UserError{
			Message: fmt.Sprintf("Could not reach the Voidhash API (%s).", transport.url),
			Hint:    "Check your connection, or the api_url 'voidhash config' shows.",
			Cause:   err,
		}
	}
	var apiErr *voidhash.APIError
	if !errors.As(err, &apiErr) {
		return err
	}
	requestID := ""
	if apiErr.RequestID != "" {
		requestID = "Request id: " + apiErr.RequestID
	}
	if apiErr.Type == "" {
		return &UserError{
			Message:  fmt.Sprintf("The Voidhash API answered HTTP %d.", apiErr.StatusCode),
			Hint:     requestID,
			ExitCode: ExitCodeForStatus(apiErr.StatusCode),
			Cause:    err,
		}
	}
	known, ok := errorTypes[apiErr.Type]
	if !ok {
		known = errorType{exitCode: ExitCodeForStatus(apiErr.StatusCode), unexpected: true}
	}
	message := apiErr.Message
	// A rule the request broke names its field, unless the message already does.
	if apiErr.Type == "invalid_request" && apiErr.Param != "" && !strings.Contains(message, apiErr.Param) {
		// The server writes some messages without a final period.
		if !strings.HasSuffix(message, ".") && !strings.HasSuffix(message, "?") && !strings.HasSuffix(message, "!") {
			message += "."
		}
		message += " The problem is with " + apiErr.Param + "."
	}
	hint := known.hint
	if replaced, ok := hints[apiErr.Code]; ok {
		hint = replaced
	}
	if known.unexpected && requestID != "" {
		hint = strings.TrimSpace(hint + "\n" + requestID)
	}
	return &UserError{Message: message, Hint: hint, ExitCode: known.exitCode, Cause: err}
}

// describe turns any error a command returned into the failure to show.
// It returns nil for an interruption, which is reported by its exit code
// alone.
func describe(err error) *UserError {
	var userErr *UserError
	if errors.As(err, &userErr) {
		return userErr
	}
	if errors.Is(err, prompt.ErrInterrupted) || errors.Is(err, context.Canceled) {
		return nil
	}
	if IsAPIError(err) {
		if errors.As(APIError(err, nil), &userErr) {
			return userErr
		}
	}
	return &UserError{
		Message: "Something went wrong: " + err.Error(),
		Hint:    "Run the command again with --debug to see the details.",
		Cause:   err,
	}
}

// report prints err the way every failure is shown, and returns the exit
// code the run ends with.
func (a *App) report(err error) int {
	if err == nil {
		return ExitOK
	}
	shown := describe(err)
	if shown == nil {
		return ExitInterrupted
	}
	style := a.ErrStyle()
	if a.Debug && shown.Cause != nil {
		var apiErr *voidhash.APIError
		if errors.As(shown.Cause, &apiErr) {
			a.Debugf("HTTP %d, request id %q, body: %s", apiErr.StatusCode, apiErr.RequestID, Printable(apiErr.Body))
		} else {
			a.Debugf("%s", PrintableLines(fmt.Sprintf("%+v", shown.Cause)))
		}
	}
	fmt.Fprintln(a.Stderr, style.Bold(style.Red("error:"))+" "+PrintableLines(shown.Message))
	if shown.Hint != "" {
		fmt.Fprintln(a.Stderr, style.Dim("hint:")+" "+PrintableLines(shown.Hint))
	}
	if shown.ExitCode == 0 {
		return ExitFailure
	}
	return shown.ExitCode
}
