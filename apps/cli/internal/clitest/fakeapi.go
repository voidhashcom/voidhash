package clitest

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
)

// Request is one request the fake API received.
type Request struct {
	Method string
	Path   string
	Query  url.Values
	Header http.Header
	// Body is the JSON body decoded, or the fields of a form body; empty
	// when there was none.
	Body M
	// Raw is the body as it was sent.
	Raw []byte

	params map[string]string
}

// Param is the value of a {name} segment of the route's pattern.
func (r *Request) Param(name string) string { return r.params[name] }

// Text is the string at key of the JSON or form body, or empty.
func (r *Request) Text(key string) string {
	text, _ := r.Body[key].(string)
	return text
}

// Answer is what the fake API answers: a status, and the JSON body when
// there is one.
type Answer struct {
	Status int
	Body   any
	Header map[string]string
}

// JSON answers status with body as JSON.
func JSON(status int, body any) Answer { return Answer{Status: status, Body: body} }

// OK answers 200 with body as JSON.
func OK(body any) Answer { return Answer{Status: http.StatusOK, Body: body} }

// NoContent answers 204.
func NoContent() Answer { return Answer{Status: http.StatusNoContent} }

// Page answers 200 with a one-page listing of items.
func Page(items ...any) Answer {
	if items == nil {
		items = []any{}
	}
	return OK(M{"data": items, "pageInfo": M{"endCursor": nil, "hasNextPage": false}})
}

// Paginate answers 200 with the page of items the request asks for with its
// `limit` and `cursor`, so a test can check that a command reads every page.
func Paginate(r *Request, items []any) Answer {
	limit, err := strconv.Atoi(r.Query.Get("limit"))
	if err != nil || limit <= 0 {
		limit = 50
	}
	start, _ := strconv.Atoi(r.Query.Get("cursor"))
	start = min(max(start, 0), len(items))
	end := min(start+limit, len(items))
	info := M{"endCursor": nil, "hasNextPage": false}
	if end < len(items) {
		info = M{"endCursor": strconv.Itoa(end), "hasNextPage": true}
	}
	page := items[start:end]
	if page == nil {
		page = []any{}
	}
	return OK(M{"data": page, "pageInfo": info})
}

// Failure answers with the API's error envelope.
func Failure(status int, errorType, code, message string) Answer {
	return JSON(status, M{"error": M{"type": errorType, "code": code, "message": message}})
}

// NotFound answers 404 with the API's error envelope.
func NotFound(code, message string) Answer {
	return Failure(http.StatusNotFound, "not_found", code, message)
}

// TwoProjectSession is a signed-in person, Dana Doe, who can use acme/app
// (proj_app) and acme/web (proj_web) in the organization Acme (org_1).
func TwoProjectSession() M {
	return M{
		"kind":           "cli_key",
		"person":         M{"id": "user_1", "name": "Dana Doe", "email": "dana@example.com"},
		"connectedAppId": "conn_1",
		"isReadOnly":     false,
		"organizations":  []any{M{"id": "org_1", "name": "Acme", "slug": "acme"}},
		"projects": []any{
			M{"id": "proj_app", "organizationId": "org_1", "name": "App", "slug": "app"},
			M{"id": "proj_web", "organizationId": "org_1", "name": "Web", "slug": "web"},
		},
	}
}

// OneProjectSession is [TwoProjectSession] with acme/app only, so commands
// act on it without a --project, a link or a default.
func OneProjectSession() M {
	session := TwoProjectSession()
	session["projects"] = session["projects"].([]any)[:1]
	return session
}

type route struct {
	method   string
	segments []string
	handler  func(r *Request) Answer
}

// FakeAPI is an in-memory Voidhash API for running commands against. It is
// the HTTP transport of the run, so it answers whatever host the CLI is
// configured for. Out of the box it answers `GET /api/v1/session` with
// Session and everything else with a 404 `route_not_found`; a test adds the
// routes its commands call with [FakeAPI.Handle].
type FakeAPI struct {
	// Session is what `GET /api/v1/session` answers; [TwoProjectSession] by
	// default.
	Session M
	// SignedOut answers every call without a route of its own with 401, as
	// for a credential the API no longer accepts.
	SignedOut bool
	// Offline fails every request, as when the network is down.
	Offline bool

	mu       sync.Mutex
	routes   []route
	requests []*Request
	// handling lets one handler run at a time, so the plain variables a
	// test's handlers share need no lock when a command sends requests
	// together.
	handling sync.Mutex
}

// NewFakeAPI creates a fake API signed in as [TwoProjectSession].
func NewFakeAPI() *FakeAPI {
	return &FakeAPI{Session: TwoProjectSession()}
}

// Handle answers the requests that match pattern, a method and a path such
// as "GET /api/v1/projects/{projectId}/products/{productId}". A {name}
// segment matches any one segment, read with [Request.Param]; a final
// {name...} matches the rest of the path. A route added later wins over an
// earlier one, and over the built-in session route.
func (f *FakeAPI) Handle(pattern string, handler func(r *Request) Answer) {
	method, path, ok := strings.Cut(pattern, " ")
	if !ok {
		panic("clitest: a route pattern is a method and a path, such as \"GET /api/v1/session\": " + pattern)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.routes = append(f.routes, route{method: method, segments: strings.Split(strings.Trim(path, "/"), "/"), handler: handler})
}

// HandleAnswer answers the requests that match pattern with answer.
func (f *FakeAPI) HandleAnswer(pattern string, answer Answer) {
	f.Handle(pattern, func(*Request) Answer { return answer })
}

// HandleList answers the requests that match pattern with the listing of
// items, a page at a time as the request's `limit` and `cursor` ask.
func (f *FakeAPI) HandleList(pattern string, items ...any) {
	f.Handle(pattern, func(r *Request) Answer { return Paginate(r, items) })
}

// Requests are the requests received so far, in order.
func (f *FakeAPI) Requests() []*Request {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]*Request(nil), f.requests...)
}

// Calls are the requests received so far as "GET /api/v1/session".
func (f *FakeAPI) Calls() []string {
	requests := f.Requests()
	calls := make([]string, len(requests))
	for index, request := range requests {
		calls[index] = request.Method + " " + request.Path
	}
	return calls
}

// Writes are the calls that change something: every call but a GET.
func (f *FakeAPI) Writes() []string {
	var writes []string
	for _, call := range f.Calls() {
		if !strings.HasPrefix(call, "GET ") {
			writes = append(writes, call)
		}
	}
	return writes
}

// Last is the most recent request that matches pattern (see
// [FakeAPI.Handle]), or nil.
func (f *FakeAPI) Last(pattern string) *Request {
	method, path, _ := strings.Cut(pattern, " ")
	segments := strings.Split(strings.Trim(path, "/"), "/")
	requests := f.Requests()
	for index := len(requests) - 1; index >= 0; index-- {
		if _, ok := match(route{method: method, segments: segments}, requests[index]); ok {
			return requests[index]
		}
	}
	return nil
}

// Reset forgets the requests received so far.
func (f *FakeAPI) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.requests = nil
}

func match(candidate route, request *Request) (map[string]string, bool) {
	if candidate.method != request.Method {
		return nil, false
	}
	parts := strings.Split(strings.Trim(request.Path, "/"), "/")
	params := map[string]string{}
	for index, segment := range candidate.segments {
		if name, ok := strings.CutSuffix(segment, "...}"); ok && strings.HasPrefix(name, "{") {
			if index > len(parts) {
				return nil, false
			}
			params[name[1:]] = strings.Join(parts[index:], "/")
			return params, true
		}
		if index >= len(parts) {
			return nil, false
		}
		if strings.HasPrefix(segment, "{") && strings.HasSuffix(segment, "}") {
			params[segment[1:len(segment)-1]] = parts[index]
		} else if segment != parts[index] {
			return nil, false
		}
	}
	return params, len(parts) == len(candidate.segments)
}

func (f *FakeAPI) answer(request *Request) Answer {
	f.mu.Lock()
	routes := append([]route(nil), f.routes...)
	f.mu.Unlock()
	for index := len(routes) - 1; index >= 0; index-- {
		if params, ok := match(routes[index], request); ok {
			request.params = params
			f.handling.Lock()
			defer f.handling.Unlock()
			return routes[index].handler(request)
		}
	}
	if f.SignedOut {
		return Failure(http.StatusUnauthorized, "unauthenticated", "invalid_api_key", "This key is not valid.")
	}
	if request.Method == http.MethodGet && request.Path == "/api/v1/session" {
		return OK(f.Session)
	}
	return NotFound("route_not_found", "No route "+request.Method+" "+request.Path+".")
}

// RoundTrip answers an HTTP request, making FakeAPI an [http.RoundTripper].
func (f *FakeAPI) RoundTrip(req *http.Request) (*http.Response, error) {
	if err := req.Context().Err(); err != nil {
		return nil, err
	}
	if f.Offline {
		return nil, errors.New("dial tcp: connection refused")
	}
	request := &Request{
		Method: req.Method,
		Path:   req.URL.Path,
		Query:  req.URL.Query(),
		Header: req.Header.Clone(),
		Body:   M{},
	}
	if req.Body != nil {
		raw, err := io.ReadAll(req.Body)
		req.Body.Close()
		if err != nil {
			return nil, err
		}
		request.Raw = raw
		if strings.HasPrefix(req.Header.Get("Content-Type"), "application/x-www-form-urlencoded") {
			if form, err := url.ParseQuery(string(raw)); err == nil {
				for name := range form {
					request.Body[name] = form.Get(name)
				}
			}
		} else if len(bytes.TrimSpace(raw)) > 0 {
			_ = json.Unmarshal(raw, &request.Body)
		}
	}
	f.mu.Lock()
	f.requests = append(f.requests, request)
	f.mu.Unlock()

	answer := f.answer(request)
	if answer.Status == 0 {
		answer.Status = http.StatusOK
	}
	var body []byte
	if answer.Body != nil {
		switch typed := answer.Body.(type) {
		case []byte:
			body = typed
		case string:
			body = []byte(typed)
		case json.RawMessage:
			body = typed
		default:
			encoded, err := json.Marshal(answer.Body)
			if err != nil {
				return nil, err
			}
			body = encoded
		}
	}
	header := http.Header{"Content-Type": {"application/json"}, "Request-Id": {"req_test"}}
	for name, value := range answer.Header {
		header.Set(name, value)
	}
	return &http.Response{
		StatusCode:    answer.Status,
		Status:        strconv.Itoa(answer.Status) + " " + http.StatusText(answer.Status),
		Proto:         "HTTP/1.1",
		ProtoMajor:    1,
		ProtoMinor:    1,
		Header:        header,
		Body:          io.NopCloser(bytes.NewReader(body)),
		ContentLength: int64(len(body)),
		Request:       req,
	}, nil
}
