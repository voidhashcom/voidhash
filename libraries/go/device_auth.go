package voidhash

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// DeviceAuth signs a person in from a tool without a browser of its own,
// such as a command line, with the OAuth 2.0 device authorization grant
// (RFC 8628): the tool shows a code, the person approves it in the
// dashboard, and the tool receives a token that acts as them.
//
//	auth := &voidhash.DeviceAuth{ClientID: "my-tool"}
//	authorization, err := auth.Start(ctx, voidhash.DeviceAuthorizationParams{})
//	// Show authorization.VerificationURI and authorization.UserCode.
//	token, err := auth.Wait(ctx, authorization)
//	client, err := voidhash.New(token.AccessToken, voidhash.WithProjectID("proj_..."))
//
// The zero value is not usable: set ClientID. A DeviceAuth is safe for
// concurrent use once its fields are set.
type DeviceAuth struct {
	// BaseURL is the management API base URL. Defaults to [DefaultBaseURL].
	BaseURL string
	// ClientID is the OAuth client the tool signs in as.
	ClientID string
	// HTTPClient sends the requests. Defaults to [http.DefaultClient].
	HTTPClient *http.Client
	// Sleep waits between polls in [DeviceAuth.Wait]. It defaults to a timer
	// that ends early when the context does; tests replace it.
	Sleep func(ctx context.Context, d time.Duration) error
	// Now is the clock [DeviceAuth.Wait] reads the code's expiry from.
	// Defaults to [time.Now].
	Now func() time.Time
}

// DeviceAuthorizationParams describes the sign-in [DeviceAuth.Start] asks for.
type DeviceAuthorizationParams struct {
	// Scope is the access asked for: "read write" (the default), or "read"
	// for a session that cannot change anything.
	Scope string
	// DeviceName names the computer to the person approving the sign-in.
	DeviceName string
	// InstallID identifies this installation of the tool, so the server keeps
	// one session per installation: signing in again replaces the earlier one.
	InstallID string
}

// DeviceAuthorization is a started sign-in (RFC 8628 §3.2): the code the
// person enters, where they enter it, and what the tool polls with.
type DeviceAuthorization struct {
	// DeviceCode is what [DeviceAuth.Wait] polls with. Keep it private.
	DeviceCode string
	// UserCode is the code the person enters at VerificationURI.
	UserCode string
	// VerificationURI is the page the person opens to enter UserCode.
	VerificationURI string
	// VerificationURIComplete is VerificationURI with the code filled in, or
	// empty when the server sent none.
	VerificationURIComplete string
	// ExpiresIn is how long the codes stay valid.
	ExpiresIn time.Duration
	// Interval is the least time to wait between polls.
	Interval time.Duration
}

// DeviceToken is the credential an approved sign-in ends in.
type DeviceToken struct {
	// AccessToken is the person's token (vh_oat_...), a bearer credential for
	// [New] and [NewWithTokenSource].
	AccessToken string
	// Scope is the access the person granted, such as "read", or empty when
	// the server did not say.
	Scope string
}

// OAuthError is an answer the OAuth endpoints refused a request with.
type OAuthError struct {
	// StatusCode is the HTTP status of the answer.
	StatusCode int
	// Code is the OAuth error, such as "authorization_pending", "slow_down"
	// or "access_denied"; empty when the answer was not an OAuth error.
	Code string
	// Description explains the error to a person, when the server sent one.
	Description string
	// RetryAfter is how long the server asked to wait before trying again,
	// or zero when it did not say.
	RetryAfter time.Duration
}

// Error implements the error interface.
func (e *OAuthError) Error() string {
	switch {
	case e.Description != "":
		return fmt.Sprintf("voidhash: %d %s: %s", e.StatusCode, e.Code, e.Description)
	case e.Code != "":
		return fmt.Sprintf("voidhash: %d %s", e.StatusCode, e.Code)
	default:
		return fmt.Sprintf("voidhash: unexpected HTTP %d", e.StatusCode)
	}
}

// DeviceAuthReason says why [DeviceAuth.Wait] ended without a token.
type DeviceAuthReason string

const (
	// DeviceAuthDenied: the person denied the sign-in.
	DeviceAuthDenied DeviceAuthReason = "denied"
	// DeviceAuthExpired: the code expired before it was approved.
	DeviceAuthExpired DeviceAuthReason = "expired"
	// DeviceAuthInvalidGrant: the server no longer knows the code.
	DeviceAuthInvalidGrant DeviceAuthReason = "invalid_grant"
	// DeviceAuthRejected: the server refused the sign-in for another reason.
	DeviceAuthRejected DeviceAuthReason = "rejected"
)

// DeviceAuthError is returned by [DeviceAuth.Wait] when the sign-in ended
// without a token. Branch on Reason.
type DeviceAuthError struct {
	Reason DeviceAuthReason
	// Message explains the failure to a person.
	Message string
}

// Error implements the error interface.
func (e *DeviceAuthError) Error() string { return e.Message }

// AuthorizationServerMetadata is the part of a server's OAuth metadata
// (RFC 8414) that says where people sign in.
type AuthorizationServerMetadata struct {
	// Issuer is the origin the metadata speaks for.
	Issuer string `json:"issuer"`
	// AuthorizationEndpoint is the dashboard page people approve access on.
	AuthorizationEndpoint string `json:"authorization_endpoint"`
}

const (
	deviceCodeGrant = "urn:ietf:params:oauth:grant-type:device_code"

	// A server that accepts a connection and never answers must not hang the
	// caller.
	oauthRequestTimeout  = 20 * time.Second
	oauthPollTimeout     = 30 * time.Second
	oauthMetadataTimeout = 10 * time.Second

	// The longest wait between polls while they fail to reach the server.
	maxPollBackoff = 60 * time.Second
)

// Start asks the server for a device code. It returns an [*OAuthError] when
// the server refuses, with RetryAfter set when it limits sign-in attempts
// (status 429, or "slow_down").
func (d *DeviceAuth) Start(ctx context.Context, params DeviceAuthorizationParams) (*DeviceAuthorization, error) {
	if d.ClientID == "" {
		return nil, newConfigurationError("DeviceAuth.ClientID is required")
	}
	scope := params.Scope
	if scope == "" {
		scope = "read write"
	}
	fields := url.Values{"client_id": {d.ClientID}, "scope": {scope}}
	if params.InstallID != "" {
		fields.Set("install_id", params.InstallID)
	}
	if params.DeviceName != "" {
		fields.Set("device_name", params.DeviceName)
	}

	answer, err := d.postForm(ctx, "/oauth/device_authorization", fields, oauthRequestTimeout)
	if err != nil {
		return nil, err
	}
	if answer.status != http.StatusOK {
		return nil, answer.oauthError(d.now())
	}

	var body struct {
		DeviceCode              *string  `json:"device_code"`
		UserCode                *string  `json:"user_code"`
		VerificationURI         *string  `json:"verification_uri"`
		VerificationURIComplete string   `json:"verification_uri_complete"`
		ExpiresIn               *float64 `json:"expires_in"`
		Interval                float64  `json:"interval"`
	}
	if json.Unmarshal(answer.body, &body) != nil || body.DeviceCode == nil || body.UserCode == nil ||
		body.VerificationURI == nil || body.ExpiresIn == nil {
		return nil, errors.New("voidhash: the server's device authorization could not be read")
	}
	interval := body.Interval
	if interval == 0 {
		interval = 5
	}
	return &DeviceAuthorization{
		DeviceCode:              *body.DeviceCode,
		UserCode:                *body.UserCode,
		VerificationURI:         *body.VerificationURI,
		VerificationURIComplete: body.VerificationURIComplete,
		ExpiresIn:               seconds(*body.ExpiresIn),
		Interval:                seconds(interval),
	}, nil
}

// Token asks once for the token of a device code. It returns an
// [*OAuthError] while the person has not approved ("authorization_pending",
// "slow_down") and when the sign-in ended ("access_denied",
// "expired_token", "invalid_grant"). Any other error means the server gave
// no usable answer and the poll can be repeated. Most callers want
// [DeviceAuth.Wait], which polls for them.
func (d *DeviceAuth) Token(ctx context.Context, deviceCode string) (*DeviceToken, error) {
	return d.token(ctx, deviceCode, oauthRequestTimeout)
}

func (d *DeviceAuth) token(ctx context.Context, deviceCode string, timeout time.Duration) (*DeviceToken, error) {
	answer, err := d.postForm(ctx, "/oauth/token", url.Values{
		"grant_type":  {deviceCodeGrant},
		"device_code": {deviceCode},
		"client_id":   {d.ClientID},
	}, timeout)
	if err != nil {
		return nil, err
	}
	if answer.status == http.StatusOK {
		var body struct {
			AccessToken *string `json:"access_token"`
			TokenType   *string `json:"token_type"`
			Scope       string  `json:"scope"`
		}
		if json.Unmarshal(answer.body, &body) == nil && body.AccessToken != nil && body.TokenType != nil {
			return &DeviceToken{AccessToken: *body.AccessToken, Scope: body.Scope}, nil
		}
	}
	if answer.status >= 400 && answer.status < 500 {
		if oauthErr := answer.oauthError(d.now()); oauthErr.Code != "" {
			return nil, oauthErr
		}
	}
	return nil, fmt.Errorf("voidhash: unexpected answer from the token endpoint (status %d)", answer.status)
}

// Wait polls for the token of a started sign-in until the person approves
// or denies it, or its code expires (RFC 8628 §3.4 and §3.5). It waits the
// authorization's interval before each poll and five seconds longer after
// every "slow_down", and backs off while polls fail to reach the server.
// It returns a [*DeviceAuthError] when the sign-in ended without a token,
// and the context's error when ctx ends first.
func (d *DeviceAuth) Wait(ctx context.Context, authorization *DeviceAuthorization) (*DeviceToken, error) {
	expired := &DeviceAuthError{Reason: DeviceAuthExpired, Message: "The sign-in code expired before it was approved."}
	deadline := d.now().Add(authorization.ExpiresIn)
	interval := max(authorization.Interval, time.Second)

	failures := 0
	for {
		wait := min(interval<<min(failures, 16), max(interval, maxPollBackoff))
		if err := d.sleep(ctx, wait); err != nil {
			return nil, err
		}
		remaining := deadline.Sub(d.now())
		if remaining <= 0 {
			return nil, expired
		}

		token, err := d.token(ctx, authorization.DeviceCode, min(oauthPollTimeout, remaining))
		if err == nil {
			return token, nil
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		var oauthErr *OAuthError
		if !errors.As(err, &oauthErr) {
			failures++
			continue
		}
		failures = 0
		switch oauthErr.Code {
		case "authorization_pending":
		case "slow_down":
			interval += 5 * time.Second
		case "access_denied":
			return nil, &DeviceAuthError{Reason: DeviceAuthDenied, Message: "The sign-in was denied in the browser."}
		case "expired_token":
			return nil, expired
		case "invalid_grant":
			return nil, &DeviceAuthError{Reason: DeviceAuthInvalidGrant, Message: "The sign-in code is no longer valid."}
		default:
			detail := oauthErr.Description
			if detail == "" {
				detail = oauthErr.Code
			}
			return nil, &DeviceAuthError{Reason: DeviceAuthRejected, Message: "The server refused the sign-in: " + detail}
		}
	}
}

// Revoke ends the session of a person's token on the server (RFC 7009). It
// returns an [*OAuthError] when the server answers with an error. A project
// key (vh_sk_..., vh_pk_...) is not a session, and revoking does not end it.
func (d *DeviceAuth) Revoke(ctx context.Context, token string) error {
	answer, err := d.postForm(ctx, "/oauth/revoke", url.Values{
		"token":     {token},
		"client_id": {d.ClientID},
	}, oauthRequestTimeout)
	if err != nil {
		return err
	}
	if answer.status < 200 || answer.status >= 300 {
		return answer.oauthError(d.now())
	}
	return nil
}

// ServerMetadata reads the server's OAuth metadata
// (/.well-known/oauth-authorization-server), which names the dashboard
// people sign in at. Redirects are not followed, so only the server at
// BaseURL can answer. Before trusting the answer, check that Issuer is the
// origin of BaseURL.
func (d *DeviceAuth) ServerMetadata(ctx context.Context) (*AuthorizationServerMetadata, error) {
	endpoint, err := d.endpoint("/.well-known/oauth-authorization-server")
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, oauthMetadataTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("voidhash: building request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	client := *d.httpClient()
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("voidhash: request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, &OAuthError{StatusCode: resp.StatusCode}
	}
	metadata := &AuthorizationServerMetadata{}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(metadata); err != nil {
		return nil, fmt.Errorf("voidhash: decoding response: %w", err)
	}
	if metadata.Issuer == "" || metadata.AuthorizationEndpoint == "" {
		return nil, errors.New("voidhash: the server's metadata names no issuer or authorization endpoint")
	}
	return metadata, nil
}

func (d *DeviceAuth) httpClient() *http.Client {
	if d.HTTPClient != nil {
		return d.HTTPClient
	}
	return http.DefaultClient
}

func (d *DeviceAuth) now() time.Time {
	if d.Now != nil {
		return d.Now()
	}
	return time.Now()
}

func (d *DeviceAuth) sleep(ctx context.Context, wait time.Duration) error {
	if d.Sleep != nil {
		return d.Sleep(ctx, wait)
	}
	timer := time.NewTimer(wait)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// endpoint is path on the server's origin: the OAuth endpoints live at the
// root, whatever path BaseURL carries.
func (d *DeviceAuth) endpoint(path string) (string, error) {
	base := d.BaseURL
	if base == "" {
		base = DefaultBaseURL
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed.Host == "" {
		return "", newConfigurationError("DeviceAuth.BaseURL is not a valid URL: " + base)
	}
	return (&url.URL{Scheme: parsed.Scheme, Host: parsed.Host, Path: path}).String(), nil
}

type oauthAnswer struct {
	status     int
	retryAfter string
	body       []byte
}

// oauthError reads the answer as an OAuth error (RFC 6749 §5.2).
func (a oauthAnswer) oauthError(now time.Time) *OAuthError {
	var body struct {
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	_ = json.Unmarshal(a.body, &body)
	return &OAuthError{
		StatusCode:  a.status,
		Code:        body.Error,
		Description: body.ErrorDescription,
		RetryAfter:  retryAfter(a.retryAfter, now),
	}
}

// retryAfter reads a Retry-After header (RFC 9110 §10.2.3), which holds
// either the seconds to wait or the date to wait until.
func retryAfter(value string, now time.Time) time.Duration {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	if wait, err := strconv.Atoi(value); err == nil && wait >= 0 {
		return time.Duration(wait) * time.Second
	}
	if until, err := http.ParseTime(value); err == nil {
		return max(0, until.Sub(now))
	}
	return 0
}

func seconds(value float64) time.Duration {
	return time.Duration(value * float64(time.Second))
}

func (d *DeviceAuth) postForm(ctx context.Context, path string, fields url.Values, timeout time.Duration) (oauthAnswer, error) {
	endpoint, err := d.endpoint(path)
	if err != nil {
		return oauthAnswer{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(fields.Encode()))
	if err != nil {
		return oauthAnswer{}, fmt.Errorf("voidhash: building request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := d.httpClient().Do(req)
	if err != nil {
		return oauthAnswer{}, fmt.Errorf("voidhash: request failed: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return oauthAnswer{}, fmt.Errorf("voidhash: reading response: %w", err)
	}
	return oauthAnswer{status: resp.StatusCode, retryAfter: resp.Header.Get("Retry-After"), body: body}, nil
}
