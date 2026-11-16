package voidhash

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

// APIError is returned for every non-2xx API response, and for a client
// configuration no request can be made with. Branch on Type and Code, which
// are stable, never on Message.
type APIError struct {
	// StatusCode is the HTTP status of the failed response.
	StatusCode int
	// Type is the kind of failure, for example "not_found",
	// "permission_denied" or "invalid_request".
	Type string
	// Code names the specific failure, for example "person_not_found".
	Code string
	// Message explains the failure to a person.
	Message string
	// Param names the request field the failure is about, when there is one.
	Param string
	// RequestID is the response's Request-Id header. Quote it when you
	// contact support.
	RequestID string
	// Tag is the event ingestion API's error discriminant (for example
	// "CaptureUnauthorizedError"). The management API sends none.
	Tag string
	// Body is the raw response body, useful when the response was not a
	// Voidhash error, such as a proxy's error page.
	Body string
}

// Error implements the error interface.
func (e *APIError) Error() string {
	var message strings.Builder
	message.WriteString("voidhash: ")
	switch {
	case e.Code != "" || e.Tag != "":
		code := e.Code
		if code == "" {
			code = e.Tag
		}
		fmt.Fprintf(&message, "%d %s", e.StatusCode, code)
		if e.Message != "" {
			message.WriteString(": " + e.Message)
		}
	case e.Message != "":
		message.WriteString(e.Message)
	default:
		fmt.Fprintf(&message, "unexpected HTTP %d: %s", e.StatusCode, e.Body)
	}
	if e.RequestID != "" {
		fmt.Fprintf(&message, " (request %s)", e.RequestID)
	}
	return message.String()
}

// errorEnvelope is the management API's error body.
type errorEnvelope struct {
	Error struct {
		Type    string  `json:"type"`
		Code    string  `json:"code"`
		Message string  `json:"message"`
		Param   *string `json:"param"`
	} `json:"error"`
}

// ingestErrorBody is the event ingestion API's error body, whose error field
// is the message.
type ingestErrorBody struct {
	Tag   string `json:"_tag"`
	Code  string `json:"code"`
	Error string `json:"error"`
}

func newAPIError(resp *http.Response, body []byte) *APIError {
	apiErr := &APIError{
		StatusCode: resp.StatusCode,
		RequestID:  resp.Header.Get("Request-Id"),
		Body:       string(body),
	}

	var envelope errorEnvelope
	if json.Unmarshal(body, &envelope) == nil && envelope.Error.Type != "" {
		apiErr.Type = envelope.Error.Type
		apiErr.Code = envelope.Error.Code
		apiErr.Message = envelope.Error.Message
		if envelope.Error.Param != nil {
			apiErr.Param = *envelope.Error.Param
		}
		return apiErr
	}

	var ingest ingestErrorBody
	if json.Unmarshal(body, &ingest) == nil {
		apiErr.Tag = ingest.Tag
		apiErr.Code = ingest.Code
		apiErr.Message = ingest.Error
	}
	return apiErr
}

// newConfigurationError reports a client setup that no request can be made
// with. It carries status 400 and no Type or Code, since the API never saw it.
func newConfigurationError(message string) *APIError {
	return &APIError{StatusCode: http.StatusBadRequest, Message: message}
}

// IsNotFound reports whether err is an APIError with status 404.
func IsNotFound(err error) bool {
	return StatusCode(err) == http.StatusNotFound
}

// StatusCode extracts the HTTP status from an [*APIError], or 0 for other
// errors. Works through error wrapping.
func StatusCode(err error) int {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr.StatusCode
	}
	return 0
}
