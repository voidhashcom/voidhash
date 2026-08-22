// Package voidhash provides an idiomatic Go client for the Voidhash API.
//
// The client mirrors the API's resource structure:
//
//	client, err := voidhash.New("vh_sk_...")
//	person, err := client.Persons.GetByDistinctID(ctx, "user-123")
//
// Every service, event capture included, authenticates on the secret key.
//
// All request and response bodies are typed structs generated from the
// official OpenAPI document.
package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

const (
	// DefaultBaseURL is the production management API base URL.
	DefaultBaseURL = "https://api.voidhash.com"
	// DefaultIngestURL is the production event ingestion base URL.
	DefaultIngestURL = "https://ingest.voidhash.com"
)

const secretKeyHeader = "x-secret-key"

// Client is a Voidhash management API client. Create one with [New]; it is
// safe for concurrent use.
type Client struct {
	secretKey      string
	publishableKey string
	extraHeaders   map[string]string
	httpClient     *http.Client
	core           *api.Client
	ingestBase     string

	Auth          *AuthService
	APIKeys       *APIKeysService
	Persons       *PersonsService
	Perks         *PerksService
	Organizations *OrganizationsService
	Projects      *ProjectsService
	Products      *ProductsService
	Paywalls      *PaywallsService
	Schema        *SchemaService
	Notifications *NotificationsService
	Users         *UsersService
	Webhooks      *WebhooksService
	EventCapture  *EventCaptureService
}

// Option configures a [Client].
type Option func(*clientConfig)

type clientConfig struct {
	baseURL        string
	ingestURL      string
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

// WithHeader sends an additional header with every request. The reserved
// x-secret-key header cannot be set here.
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
// invalid.
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
	if _, exists := cfg.headers[secretKeyHeader]; exists {
		return nil, newConfigurationError("x-secret-key cannot be set explicitly")
	}

	requestEditor := func(ctx context.Context, req *http.Request) error {
		req.Header.Set(secretKeyHeader, secretKey)
		for name, value := range cfg.headers {
			req.Header.Set(name, value)
		}
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
	client.Webhooks = &WebhooksService{client: client}
	client.EventCapture = &EventCaptureService{client: client}

	return client, nil
}
