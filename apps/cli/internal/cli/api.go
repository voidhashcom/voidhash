package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/voidhashcom/voidhash-go"
	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/credentials"
)

// Object is one API object: Value decoded into its generated type, for the
// command to work with, and Raw as the server sent it, which --json prints.
type Object[T any] struct {
	Value T
	Raw   json.RawMessage
}

// RawJSON is the object as the server sent it.
func (o Object[T]) RawJSON() json.RawMessage { return o.Raw }

// ID is the object's `id`, or empty when it has none.
func (o Object[T]) ID() string { return rawID(o.Raw) }

// IDs is the object's id as a list, for --quiet.
func (o Object[T]) IDs() []string {
	if id := o.ID(); id != "" {
		return []string{id}
	}
	return nil
}

// NewObject wraps a value the command made or changed itself as an
// [Object], with Raw encoded from it, so it prints like one the API sent.
func NewObject[T any](value T) Object[T] {
	raw, _ := json.Marshal(value)
	return Object[T]{Value: value, Raw: raw}
}

// List is the items of a listing: Items decoded into their generated type,
// and Raw holding each as the server sent it, in the same order.
type List[T any] struct {
	Items []T
	Raw   []json.RawMessage
}

// RawJSON is the items as a JSON array, each as the server sent it.
func (l List[T]) RawJSON() json.RawMessage {
	var out bytes.Buffer
	out.WriteByte('[')
	for index, raw := range l.Raw {
		if index > 0 {
			out.WriteByte(',')
		}
		out.Write(raw)
	}
	out.WriteByte(']')
	return out.Bytes()
}

// IDs is the `id` of every item that has one, in order.
func (l List[T]) IDs() []string {
	ids := make([]string, 0, len(l.Raw))
	for _, raw := range l.Raw {
		if id := rawID(raw); id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

// Object returns item index with its raw JSON, for a command that lists and
// then prints one.
func (l List[T]) Object(index int) Object[T] {
	return Object[T]{Value: l.Items[index], Raw: l.Raw[index]}
}

// Filter returns the items keep accepts, with their raw JSON.
func (l List[T]) Filter(keep func(item T) bool) List[T] {
	filtered := List[T]{}
	for index, item := range l.Items {
		if keep(item) {
			filtered.Items = append(filtered.Items, item)
			filtered.Raw = append(filtered.Raw, l.Raw[index])
		}
	}
	return filtered
}

func rawID(raw json.RawMessage) string {
	var holder struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(raw, &holder)
	return holder.ID
}

// Send makes one request with the generated API client.
type Send func(c *api.Client) (*http.Response, error)

// Page is the query of one page of a listing: copy both fields into the
// operation's params.
type Page struct {
	// Cursor is where the page starts; nil for the first page.
	Cursor *string
	// Limit is how many items to ask for.
	Limit *int
}

// PageSize is how many items [ListAll] asks for per page, the most the API
// returns.
const PageSize = 100

// call sends one request and returns the body of a successful answer.
func call(ctx context.Context, a *App, send Send) ([]byte, error) {
	client, err := a.Client(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := send(client.API())
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		target := ""
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			target = urlErr.URL
		}
		return nil, &transportError{url: target, err: err}
	}
	requestID := resp.Header.Get("Request-Id")
	body, err := voidhash.ReadResponse(resp)
	if err != nil {
		var apiErr *voidhash.APIError
		if errors.As(err, &apiErr) {
			return nil, err
		}
		return nil, unreadable("The Voidhash API sent an answer the CLI could not read.", requestID, err)
	}
	return body, nil
}

func unreadable(message, requestID string, cause error) *UserError {
	hint := ""
	if requestID != "" {
		hint = "Request id: " + requestID
	}
	return &UserError{Message: message, Hint: hint, Cause: cause}
}

func decode[T any](body []byte) (Object[T], error) {
	object := Object[T]{Raw: json.RawMessage(body)}
	if len(bytes.TrimSpace(body)) == 0 {
		return object, unreadable("The Voidhash API sent an empty answer.", "", nil)
	}
	if err := json.Unmarshal(body, &object.Value); err != nil {
		return object, unreadable("The Voidhash API sent an answer the CLI could not read.", "", err)
	}
	return object, nil
}

// Fetch makes one API call and returns the object it answers with, typed
// and raw:
//
//	product, err := cli.Fetch[api.ProductJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
//		return c.ProductsGet(ctx, projectID, id)
//	})
//	// product.Value is the api.ProductJsonEncoding; app.PrintJSON(product) prints the server's JSON.
//
// A refused call returns the API's error, which the CLI shows with the next
// step for its type; see [APIError] to give a better one, and
// [APIErrorCode] to handle one yourself.
func Fetch[T any](ctx context.Context, a *App, send Send) (Object[T], error) {
	body, err := call(ctx, a, send)
	if err != nil {
		return Object[T]{}, err
	}
	return decode[T](body)
}

// Call makes one API call whose answer the command does not read, such as a
// delete.
func Call(ctx context.Context, a *App, send Send) error {
	_, err := call(ctx, a, send)
	return err
}

type pageEnvelope struct {
	Data     []json.RawMessage `json:"data"`
	PageInfo api.PageInfo      `json:"pageInfo"`
}

func decodePage[T any](body []byte, into *List[T]) (api.PageInfo, error) {
	var page pageEnvelope
	if err := json.Unmarshal(body, &page); err != nil {
		return api.PageInfo{}, unreadable("The Voidhash API sent an answer the CLI could not read.", "", err)
	}
	for _, raw := range page.Data {
		var item T
		if err := json.Unmarshal(raw, &item); err != nil {
			return api.PageInfo{}, unreadable("The Voidhash API sent an answer the CLI could not read.", "", err)
		}
		into.Items = append(into.Items, item)
		into.Raw = append(into.Raw, raw)
	}
	return page.PageInfo, nil
}

// ListAll reads every page of a listing, following the cursors, [PageSize]
// items at a time. fetch asks for one page; copy page.Cursor and page.Limit
// into the operation's params beside the command's own filters:
//
//	products, err := cli.ListAll[api.ProductJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
//		return c.ProductsList(ctx, projectID, &api.ProductsListParams{Cursor: page.Cursor, Limit: page.Limit})
//	})
func ListAll[T any](ctx context.Context, a *App, fetch func(c *api.Client, page Page) (*http.Response, error)) (List[T], error) {
	list := List[T]{Items: []T{}, Raw: []json.RawMessage{}}
	limit := PageSize
	var cursor *string
	seen := map[string]bool{}
	for {
		body, err := call(ctx, a, func(c *api.Client) (*http.Response, error) {
			return fetch(c, Page{Cursor: cursor, Limit: &limit})
		})
		if err != nil {
			return list, err
		}
		info, err := decodePage(body, &list)
		if err != nil {
			return list, err
		}
		if !info.HasNextPage || info.EndCursor == nil {
			return list, nil
		}
		if seen[*info.EndCursor] {
			return list, Failf("The Voidhash API repeated a page of the listing, so it cannot be read to its end.")
		}
		seen[*info.EndCursor] = true
		cursor = info.EndCursor
	}
}

// FetchPage reads one page of a listing, for a command with its own --limit
// or --cursor. It returns the items and where the next page starts.
func FetchPage[T any](ctx context.Context, a *App, send Send) (List[T], api.PageInfo, error) {
	list := List[T]{Items: []T{}, Raw: []json.RawMessage{}}
	body, err := call(ctx, a, send)
	if err != nil {
		return list, api.PageInfo{}, err
	}
	info, err := decodePage(body, &list)
	return list, info, err
}

// Client is the Voidhash SDK client of the run. It talks to the configured
// api_url and sends the credential for that origin, looked up on the first
// request. Most commands use [Fetch], [Call] and [ListAll] instead.
func (a *App) Client(ctx context.Context) (*voidhash.Client, error) {
	a.clientMu.Lock()
	defer a.clientMu.Unlock()
	if a.client != nil {
		return a.client, nil
	}
	settings, err := a.Config()
	if err != nil {
		return nil, err
	}
	creds := a.Credentials(ctx)
	token := func(ctx context.Context) (string, error) {
		// Looked up for the origin the request goes to, so a profile on
		// another server never sends this one's token.
		credential, err := creds.Resolve(ctx, settings.APIURL)
		if err != nil {
			return "", &UserError{Message: err.Error() + "."}
		}
		if credential == nil {
			return "", nil
		}
		return credential.Token, nil
	}
	transport := retryTransport{
		next: debugTransport{app: a, next: a.Transport},
		reload: func(ctx context.Context) string {
			credential, err := creds.Reload(ctx, settings.APIURL)
			if err != nil || credential == nil {
				return ""
			}
			return credential.Token
		},
	}
	client, err := voidhash.NewWithTokenSource(token,
		voidhash.WithBaseURL(settings.APIURL),
		voidhash.WithHTTPClient(&http.Client{Transport: transport}),
		voidhash.WithHeader("User-Agent", "voidhash-cli/"+a.Version),
	)
	if err != nil {
		return nil, &UserError{Message: "The api_url " + settings.APIURL + " is not a valid URL.", Hint: "Set it with 'voidhash config set api_url <url>'.", Cause: err}
	}
	a.client = client
	return client, nil
}

// debugTransport logs each request and its answer with --debug.
type debugTransport struct {
	app  *App
	next http.RoundTripper
}

func (t debugTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if !t.app.Debug {
		return t.next.RoundTrip(req)
	}
	started := time.Now()
	resp, err := t.next.RoundTrip(req)
	target := req.URL.Scheme + "://" + req.URL.Host + req.URL.Path
	if err != nil {
		t.app.Debugf("%s %s failed: %v", req.Method, target, err)
		return resp, err
	}
	t.app.Debugf("%s %s -> %d in %dms (request id %q)", req.Method, target, resp.StatusCode, time.Since(started).Milliseconds(), resp.Header.Get("Request-Id"))
	return resp, nil
}

// retryTransport sends a refused request once more with a newer token. The
// token is read once per run, and another run may since have signed in
// again, which ends its session. A request the API answers with 401 reads
// the stored token again, and is repeated when it changed.
type retryTransport struct {
	next   http.RoundTripper
	reload func(ctx context.Context) string
}

func (t retryTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := t.next.RoundTrip(req)
	if err != nil || resp.StatusCode != http.StatusUnauthorized {
		return resp, err
	}
	// A body that cannot be produced again cannot be sent again.
	if req.Body != nil && req.Body != http.NoBody && req.GetBody == nil {
		return resp, nil
	}
	token := t.reload(req.Context())
	if token == "" || "Bearer "+token == req.Header.Get("Authorization") {
		return resp, nil
	}
	again := req.Clone(req.Context())
	if req.GetBody != nil {
		body, err := req.GetBody()
		if err != nil {
			return resp, nil
		}
		again.Body = body
	}
	again.Header.Set("Authorization", "Bearer "+token)
	resp.Body.Close()
	return t.next.RoundTrip(again)
}

// OAuthClientID is the OAuth client the CLI signs in as.
const OAuthClientID = "voidhash-cli"

// DeviceAuth is the SDK's sign-in client for the server at apiURL, with the
// run's transport and clock.
func (a *App) DeviceAuth(apiURL string) *voidhash.DeviceAuth {
	return &voidhash.DeviceAuth{
		BaseURL:    apiURL,
		ClientID:   OAuthClientID,
		HTTPClient: a.HTTPClient(),
		Sleep:      a.Sleep,
		Now:        a.Now,
	}
}

// Revocation is what became of ending a token's session on the server.
type Revocation struct {
	// Outcome is "revoked", "not_a_session" (a project key, which is never
	// sent), "unreachable", "timed_out" or "failed".
	Outcome string
	// Status is the server's HTTP status when Outcome is "failed".
	Status int
}

// Revoked reports whether the session ended.
func (r Revocation) Revoked() bool { return r.Outcome == "revoked" }

// Note says why the session may still be active and what to do about it;
// empty when it ended. disconnect replaces the default advice.
func (r Revocation) Note(disconnect string) string {
	if disconnect == "" {
		disconnect = "disconnect the CLI under Settings → Devices and apps in the dashboard."
	}
	switch r.Outcome {
	case "not_a_session":
		return "The key is not a sign-in, so it was not revoked and still works; delete it in the dashboard if nothing else uses it."
	case "unreachable":
		return "The server could not be reached to end the session; " + disconnect
	case "timed_out":
		return "The server did not answer in time, so the session may not have ended; " + disconnect
	case "failed":
		return fmt.Sprintf("The server could not end the session (status %d); %s", r.Status, disconnect)
	default:
		return ""
	}
}

// RevokeToken ends the session of token on the server at apiURL.
// Best-effort: it never fails, and answers whether the session ended. A
// project key, such as a secret key set by hand, is never sent: revocation
// cannot end it, and should never be able to.
func (a *App) RevokeToken(ctx context.Context, apiURL, token string) Revocation {
	if !credentials.IsSessionToken(token) {
		return Revocation{Outcome: "not_a_session"}
	}
	err := a.DeviceAuth(apiURL).Revoke(ctx, token)
	var oauthErr *voidhash.OAuthError
	switch {
	case err == nil:
		return Revocation{Outcome: "revoked"}
	case errors.As(err, &oauthErr):
		return Revocation{Outcome: "failed", Status: oauthErr.StatusCode}
	case errors.Is(err, context.DeadlineExceeded):
		a.Debugf("Revoking the token failed: %v", err)
		return Revocation{Outcome: "timed_out"}
	default:
		a.Debugf("Revoking the token failed: %v", err)
		return Revocation{Outcome: "unreachable"}
	}
}

// migrateLegacyKeys moves the keys the settings file still holds from
// before the credential store into it, each under the origin it was sent
// to. Profiles on one origin share its token, so a key whose origin already
// has another token (stored before, or another profile's moved first) is
// dropped and reported: its profile now acts as whoever that token belongs
// to. A dropped sign-in is revoked unless another profile kept it for its
// own origin; a project key is left working.
func (a *App) migrateLegacyKeys(ctx context.Context) {
	store := a.ConfigStore()
	file, err := store.ReadFile()
	if err != nil {
		return
	}
	legacy := file.LegacyKeys()
	if len(legacy) == 0 {
		return
	}
	credentialStore := a.creds.Store()
	var dropped, kept []int
	for index, key := range legacy {
		origin, ok := credentials.Origin(key.APIURL)
		if !ok {
			continue
		}
		stored, err := credentialStore.Get(ctx, origin)
		if err == nil && stored == nil {
			_, err = credentialStore.Set(ctx, origin, key.APIKey)
		}
		if err != nil {
			a.Warnf("Could not move the key in %s to the credential store: %v", store.Path, err)
			return
		}
		if stored != nil && stored.Token != key.APIKey {
			dropped = append(dropped, index)
		} else {
			kept = append(kept, index)
		}
	}
	if err := store.RemoveLegacyKeys(); err != nil {
		a.Warnf("Could not move the key in %s to the credential store: %v", store.Path, err)
		return
	}
	a.Debugf("Moved the CLI key from the config into the credential store")
	for _, index := range dropped {
		key := legacy[index]
		owner, login := "The key", "voidhash login"
		if key.Profile != "" {
			owner = fmt.Sprintf("The key of the %q profile", key.Profile)
			login = "voidhash login --profile " + key.Profile
		}
		origin, _ := credentials.Origin(key.APIURL)
		reason := fmt.Sprintf("profiles on the same server share one sign-in, and %s already has another, which may be a different account.", origin)
		if !credentials.IsSessionToken(key.APIKey) {
			a.Warnf("%s in %s was removed from the config but not revoked: %s To keep using the project key, pass a copy of it in VOIDHASH_API_KEY, or create a new key in the dashboard if you kept none; to sign in as yourself, run '%s'.", owner, store.Path, reason, login)
			continue
		}
		keptElsewhere := false
		for _, other := range kept {
			keptElsewhere = keptElsewhere || legacy[other].APIKey == key.APIKey
		}
		revoked := ""
		if !keptElsewhere && a.RevokeToken(ctx, key.APIURL, key.APIKey).Revoked() {
			revoked = " and revoked"
		}
		a.Warnf("%s in %s was removed%s: %s Run '%s' to sign in as the account the key used.", owner, store.Path, revoked, reason, login)
	}
}
