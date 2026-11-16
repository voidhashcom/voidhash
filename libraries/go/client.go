// Package voidhash provides an idiomatic Go client for the Voidhash API.
//
// The client mirrors the API's resource structure:
//
//	client, err := voidhash.New("vh_sk_...")
//	person, err := client.Persons.GetByDistinctID(ctx, "user-123")
//
// Every service, event capture included, authenticates on the secret key.
// Project resources are managed in the key's own project, which the client
// looks up on its first project call; [WithProjectID] names it up front.
//
// All request and response bodies are typed structs generated from the
// official OpenAPI document.
package voidhash

import (
	"context"
	"fmt"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

const (
	// DefaultBaseURL is the production management API base URL.
	DefaultBaseURL = "https://api.voidhash.com"
	// DefaultIngestURL is the production event ingestion base URL.
	DefaultIngestURL = "https://ingest.voidhash.com"
)

// The management API reads the secret key as a bearer token; event capture
// reads it from x-secret-key.
const (
	authorizationHeader = "Authorization"
	secretKeyHeader     = "x-secret-key"
)

// Client is a Voidhash management API client. Create one with [New]; it is
// safe for concurrent use.
type Client struct {
	secretKey      string
	publishableKey string
	extraHeaders   map[string]string
	httpClient     *http.Client
	core           *api.Client
	ingestBase     string

	// projectLock is a one-slot semaphore held while the project is read or
	// resolved, so concurrent first calls share one session lookup and a
	// waiting call can still give up when its context ends. It guards
	// projectID.
	projectLock chan struct{}
	projectID   string

	Auth           *AuthService
	APIKeys        *APIKeysService
	Persons        *PersonsService
	Perks          *PerksService
	Organizations  *OrganizationsService
	Projects       *ProjectsService
	Products       *ProductsService
	Paywalls       *PaywallsService
	Schema         *SchemaService
	Notifications  *NotificationsService
	Users          *UsersService
	Webhooks       *WebhooksService
	EventCapture   *EventCaptureService
	PaymentSources *PaymentSourcesService
}

// Option configures a [Client].
type Option func(*clientConfig)

type clientConfig struct {
	baseURL        string
	ingestURL      string
	projectID      string
	publishableKey string
	httpClient     *http.Client
	headers        map[string]string
}

// WithBaseURL overrides the management API base URL. Defaults to
// [DefaultBaseURL].
func WithBaseURL(url string) Option {
	return func(cfg *clientConfig) { cfg.baseURL = url }
}

// WithIngestURL overrides the event ingestion base URL. Defaults to
// [DefaultIngestURL].
func WithIngestURL(url string) Option {
	return func(cfg *clientConfig) { cfg.ingestURL = url }
}

// WithProjectID names the project that project resources (persons, products,
// webhooks and the rest) are managed in. It is optional for a project secret
// key, which can use only its own project: without it, the client reads that
// project from the session on its first project call and keeps it. Set it
// for a credential that can use several projects, such as a CLI key.
func WithProjectID(projectID string) Option {
	return func(cfg *clientConfig) { cfg.projectID = projectID }
}

// WithPublishableKey supplies the project's publishable key (vh_pk_...).
// It is optional: [EventCaptureService] authenticates on the secret key and
// only sends the publishable key as the capture body's token when one is
// configured, mirroring what the browser and mobile SDKs send.
func WithPublishableKey(key string) Option {
	return func(cfg *clientConfig) { cfg.publishableKey = key }
}

// WithHTTPClient uses a custom *http.Client (timeouts, proxies, tracing).
func WithHTTPClient(httpClient *http.Client) Option {
	return func(cfg *clientConfig) { cfg.httpClient = httpClient }
}

// WithHeader sends an additional header with every request. The credential
// headers, Authorization and x-secret-key, cannot be set here.
func WithHeader(name, value string) Option {
	return func(cfg *clientConfig) {
		if cfg.headers == nil {
			cfg.headers = map[string]string{}
		}
		cfg.headers[name] = value
	}
}

// New creates a Voidhash client authenticated with a secret key
// (vh_sk_...). It returns an error when the key is empty or the options are
// invalid. It makes no request; the project is resolved on first use.
func New(secretKey string, opts ...Option) (*Client, error) {
	if secretKey == "" {
		return nil, newConfigurationError("secretKey is required")
	}

	cfg := &clientConfig{
		baseURL:   DefaultBaseURL,
		ingestURL: DefaultIngestURL,
	}
	for _, opt := range opts {
		opt(cfg)
	}
	for name := range cfg.headers {
		switch http.CanonicalHeaderKey(name) {
		case authorizationHeader, http.CanonicalHeaderKey(secretKeyHeader):
			return nil, newConfigurationError(name + " cannot be set explicitly; the client sends the secret key itself")
		}
	}

	requestEditor := func(ctx context.Context, req *http.Request) error {
		for name, value := range cfg.headers {
			req.Header.Set(name, value)
		}
		req.Header.Set(authorizationHeader, "Bearer "+secretKey)
		return nil
	}

	core, err := api.NewClient(cfg.baseURL, api.WithRequestEditorFn(requestEditor))
	if err != nil {
		return nil, err
	}
	if cfg.httpClient != nil {
		core.Client = cfg.httpClient
	}

	client := &Client{
		secretKey:      secretKey,
		publishableKey: cfg.publishableKey,
		extraHeaders:   cfg.headers,
		httpClient:     cfg.httpClient,
		core:           core,
		ingestBase:     cfg.ingestURL,
		projectLock:    make(chan struct{}, 1),
		projectID:      cfg.projectID,
	}

	client.Auth = &AuthService{client: client}
	client.APIKeys = &APIKeysService{client: client}
	client.Persons = &PersonsService{
		client:       client,
		Entitlements: &EntitlementsService{client: client},
	}
	client.Perks = &PerksService{client: client}
	client.Organizations = &OrganizationsService{client: client}
	client.Projects = &ProjectsService{client: client}
	client.Products = &ProductsService{client: client}
	client.Paywalls = &PaywallsService{client: client}
	client.Schema = &SchemaService{client: client}
	client.Notifications = &NotificationsService{client: client}
	client.Users = &UsersService{client: client}
	client.Webhooks = &WebhooksService{
		client:     client,
		Endpoints:  &WebhookEndpointsService{client: client},
		Deliveries: &WebhookDeliveriesService{client: client},
	}
	client.EventCapture = &EventCaptureService{client: client}
	client.PaymentSources = &PaymentSourcesService{client: client}

	return client, nil
}

// project returns the id of the project that project resources are managed
// in: the one set with [WithProjectID], or else the only project the
// credential can use, read from the session once and kept for the client's
// lifetime. A failed lookup is not kept, so the next call tries again.
func (c *Client) project(ctx context.Context) (string, error) {
	select {
	case c.projectLock <- struct{}{}:
	case <-ctx.Done():
		return "", fmt.Errorf("voidhash: resolving the project: %w", ctx.Err())
	}
	defer func() { <-c.projectLock }()

	if c.projectID != "" {
		return c.projectID, nil
	}
	session, err := c.Auth.Session(ctx)
	if err != nil {
		return "", err
	}
	if len(session.Projects) != 1 {
		return "", newConfigurationError(fmt.Sprintf(
			"the credential can use %d projects, so the client cannot tell which one to manage; set it with voidhash.WithProjectID",
			len(session.Projects),
		))
	}
	c.projectID = session.Projects[0].ID
	return c.projectID, nil
}
