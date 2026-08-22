// Command conformance-go replays the SDK test harness suites against a live
// harness server. Like the iOS and Android runners it is fully generic: step
// descriptors come from the /__harness control plane and no fixture data is
// encoded locally, so suites can evolve without touching this file.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
)

const defaultHarnessURL = "http://127.0.0.1:4919"

func main() {
	baseURL := os.Getenv("HARNESS_URL")
	if baseURL == "" {
		baseURL = defaultHarnessURL
	}
	if err := run(baseURL); err != nil {
		fmt.Fprintln(os.Stderr, "conformance:", err)
		os.Exit(1)
	}
}

func run(baseURL string) error {
	client := &http.Client{}

	suiteNames, err := listSuites(client, baseURL)
	if err != nil {
		return err
	}

	for _, name := range suiteNames {
		// The harness self-test suites exercise the verifier itself, not the
		// wire contract runners are responsible for.
		if strings.HasPrefix(name, "test/") {
			continue
		}
		if err := runSuite(client, baseURL, name); err != nil {
			return fmt.Errorf("suite %s: %w", name, err)
		}
	}
	return nil
}

func listSuites(client *http.Client, baseURL string) ([]string, error) {
	var payload struct {
		Suites []struct {
			Name string `json:"name"`
		} `json:"suites"`
	}
	if err := getJSON(client, baseURL+"/__harness/suites", &payload); err != nil {
		return nil, err
	}
	names := make([]string, 0, len(payload.Suites))
	for _, suite := range payload.Suites {
		names = append(names, suite.Name)
	}
	return names, nil
}

type session struct {
	SessionID string            `json:"sessionId"`
	Steps     []json.RawMessage `json:"steps"`
}

type stepRequest struct {
	Method        string            `json:"method"`
	Path          string            `json:"path"`
	Headers       map[string]string `json:"headers"`
	RequireHeader []string          `json:"requireHeaders"`
	Body          json.RawMessage   `json:"body"`
}

type stepResponse struct {
	Status int             `json:"status"`
	Body   json.RawMessage `json:"body"`
}

type step struct {
	ID        string         `json:"id"`
	Request   stepRequest    `json:"request"`
	Responses []stepResponse `json:"responses"`
}

type report struct {
	Pass       bool              `json:"pass"`
	Violations []json.RawMessage `json:"violations"`
}

func runSuite(client *http.Client, baseURL, suiteName string) error {
	body, _ := json.Marshal(map[string]string{"suite": suiteName})
	rawSession, err := postJSON(client, baseURL+"/__harness/sessions", body)
	if err != nil {
		return err
	}
	var active session
	if err := json.Unmarshal(rawSession, &active); err != nil {
		return err
	}

	for _, rawStep := range active.Steps {
		var current step
		if err := json.Unmarshal(rawStep, &current); err != nil {
			return err
		}
		if err := performStep(client, baseURL, &active, current); err != nil {
			return fmt.Errorf("step %s: %w", current.ID, err)
		}
	}

	rawReport, err := postJSON(client, baseURL+"/__harness/sessions/"+active.SessionID+"/complete", []byte("{}"))
	if err != nil {
		return err
	}
	var result report
	if err := json.Unmarshal(rawReport, &result); err != nil {
		return err
	}
	if !result.Pass {
		return fmt.Errorf("report failed:\n%s", rawReport)
	}
	fmt.Printf("suite %s passed (%d steps)\n", suiteName, len(active.Steps))
	return nil
}

func performStep(client *http.Client, baseURL string, active *session, current step) error {
	expectedStatus := 200
	var expectedBody json.RawMessage
	if len(current.Responses) > 0 {
		expectedStatus = current.Responses[0].Status
		expectedBody = current.Responses[0].Body
	}

	headers := map[string]string{}
	for name, value := range current.Request.Headers {
		headers[strings.ToLower(name)] = value
	}
	for _, header := range current.Request.RequireHeader {
		lower := strings.ToLower(header)
		if _, exists := headers[lower]; !exists {
			headers[lower] = "conformance-" + header
		}
	}
	if len(current.Request.Body) > 0 {
		headers["content-type"] = "application/json"
	}

	requestBody := []byte("")
	if len(current.Request.Body) > 0 && !bytes.Equal(current.Request.Body, []byte("null")) {
		requestBody = current.Request.Body
	}

	req, err := http.NewRequest(current.Request.Method, baseURL+current.Request.Path, bytes.NewReader(requestBody))
	if err != nil {
		return err
	}
	for name, value := range headers {
		req.Header.Set(name, value)
	}
	req.Header.Set("x-harness-session", active.SessionID)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode != expectedStatus {
		return fmt.Errorf("expected status %d, got %d: %s", expectedStatus, resp.StatusCode, responseBody)
	}
	if len(expectedBody) > 0 && !bytes.Equal(expectedBody, []byte("null")) {
		var expected, actual any
		if err := json.Unmarshal(expectedBody, &expected); err != nil {
			return err
		}
		if err := json.Unmarshal(responseBody, &actual); err != nil {
			return err
		}
		if !jsonMatches(expected, actual) {
			return fmt.Errorf("body mismatch\nexpected: %s\nactual: %s", expectedBody, responseBody)
		}
	}
	return nil
}

// jsonMatches reports structural JSON equality with a tiny float tolerance so
// number round-trips across languages stay comparable.
func jsonMatches(expected, actual any) bool {
	switch typedExpected := expected.(type) {
	case nil:
		return actual == nil
	case map[string]any:
		typedActual, ok := actual.(map[string]any)
		if !ok || len(typedExpected) != len(typedActual) {
			return false
		}
		for key, value := range typedExpected {
			actualValue, exists := typedActual[key]
			if !exists || !jsonMatches(value, actualValue) {
				return false
			}
		}
		return true
	case []any:
		typedActual, ok := actual.([]any)
		if !ok || len(typedExpected) != len(typedActual) {
			return false
		}
		for index, value := range typedExpected {
			if !jsonMatches(value, typedActual[index]) {
				return false
			}
		}
		return true
	case float64:
		typedActual, ok := actual.(float64)
		if !ok {
			return false
		}
		return math.Abs(typedExpected-typedActual) <= 1e-9*math.Max(1, math.Abs(typedExpected))
	default:
		return fmt.Sprintf("%v", expected) == fmt.Sprintf("%v", actual)
	}
}

func getJSON(client *http.Client, url string, out any) error {
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s: status %d: %s", url, resp.StatusCode, body)
	}
	return json.Unmarshal(body, out)
}

func postJSON(client *http.Client, url string, requestBody []byte) (json.RawMessage, error) {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(requestBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("POST %s: status %d: %s", url, resp.StatusCode, body)
	}
	return json.RawMessage(body), nil
}
