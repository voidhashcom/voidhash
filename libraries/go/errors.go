package voidhash

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
)

// APIError is returned for every non-2xx API response. Tag carries the
// server-side error discriminant exactly as sent on the wire (for example
// "Api/PersonNotFoundError"), which is the stable way to branch on specific
// failures.
type APIError struct {
	// StatusCode is the HTTP status of the failed response.
	StatusCode int
	// Tag is the error `_tag` from the response body, or "" when absent.
	Tag string
	// Body is the raw response body, useful when Tag is empty.
	Body string
}

// Error implements the error interface.
func (e *APIError) Error() string {
	if e.Tag != "" {
		return fmt.Sprintf("voidhash: %d %s", e.StatusCode, e.Tag)
	}
	return fmt.Sprintf("voidhash: unexpected HTTP %d: %s", e.StatusCode, e.Body)
}

type errorBody struct {
	Tag      string `json:"_tag"`
	Message  string `json:"message"`
	Cause    string `json:"cause"`
	Detail   string `json:"detail"`
	Issue    any    `json:"issue"`
	Response string `json:"response"`
	// Error is the message field used by the ingestion API's error bodies.
	Error string `json:"error"`
}

func newAPIError(statusCode int, body []byte) *APIError {
	apiErr := &APIError{StatusCode: statusCode, Body: string(body)}
	var decoded errorBody
	if err := json.Unmarshal(body, &decoded); err == nil {
		apiErr.Tag = decoded.Tag
		switch {
		case decoded.Message != "":
			apiErr.Body = decoded.Message
		case decoded.Cause != "":
			apiErr.Body = decoded.Cause
		case decoded.Detail != "":
			apiErr.Body = decoded.Detail
		case decoded.Response != "":
			apiErr.Body = decoded.Response
		case decoded.Error != "":
			apiErr.Body = decoded.Error
		}
	}
	return apiErr
}

func newConfigurationError(message string) *APIError {
	return &APIError{StatusCode: http.StatusBadRequest, Body: message}
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
