package voidhash

import (
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// Domain types re-exported from the generated client for a flat import
// surface. They are aliases, so they always track the OpenAPI document.
type (
	// Person is a person record.
	Person = api.PersonJsonEncoding
	// APIKey is a publishable or secret key; a secret key comes without its
	// raw value.
	APIKey = api.ApiKeyJsonEncoding
	// APIKeyWithRawKey is returned when a secret key is created or rotated;
	// RawKey is only ever sent in those responses.
	APIKeyWithRawKey = api.ApiKeyWithRawKeyJsonEncoding
	// Organization is an organization record.
	Organization = api.OrganizationJsonEncoding
	// Project is a project record.
	Project = api.ProjectJsonEncoding
	// Product is a product record.
	Product = api.ProductJsonEncoding
	// Perk is an entitlement perk definition.
	Perk = api.PerkJsonEncoding
	// PaywallLocation is a deployable paywall location.
	PaywallLocation = api.PaywallLocationJsonEncoding
	// ProjectSchema is the full runtime schema of a project.
	ProjectSchema = api.ProjectSchemaResponseJsonEncoding
	// SchemaVersion identifies the current schema revision.
	SchemaVersion = api.SchemaVersionJsonEncoding
	// User is the signed-in person a CLI key acts for.
	User = api.MeJsonEncoding
	// EntitlementGrant is a perk a person can use now.
	EntitlementGrant = api.PersonEntitlementJsonEncoding
	// WebhookEndpoint is a webhook endpoint registration.
	WebhookEndpoint = api.WebhookJsonEncoding
	// WebhookEndpointWithSecret is returned when an endpoint is created or its
	// secret rotated; Secret is only ever sent in those responses.
	WebhookEndpointWithSecret = api.WebhookWithSecretJsonEncoding
	// WebhookDelivery is one webhook delivery.
	WebhookDelivery = api.WebhookDeliveryJsonEncoding
	// WebhookDeliveryWithAttempts includes every attempt made for a delivery.
	WebhookDeliveryWithAttempts = api.WebhookDeliveryWithAttemptsJsonEncoding
	// Notification is an outbound push notification payload.
	Notification = api.CreatePushNotificationBodyJsonEncoding
	// SendNotificationResponse acknowledges a push notification whose
	// deliveries continue in the background.
	SendNotificationResponse = api.AcceptedPushNotificationJsonEncoding
	// PaymentSourceTransaction is a recorded payment source transaction:
	// applied, or pending with a PendingReason.
	PaymentSourceTransaction = api.PaymentSourceTransaction
	// PaymentSourceSubscription is a recorded payment source subscription
	// state: applied, pending with a PendingReason, or superseded.
	PaymentSourceSubscription = api.PaymentSourceSubscription

	// CreateAPIKeyParams is the body for [APIKeysService.Create].
	CreateAPIKeyParams = api.CreateApiKeyBodyJsonEncoding
	// CreatePersonParams is the body for [PersonsService.Create].
	CreatePersonParams = api.CreatePersonBodyJsonEncoding
	// CreateOrganizationParams is the body for [OrganizationsService.Create].
	CreateOrganizationParams = api.CreateOrganizationBodyJsonEncoding
	// CreateProjectParams is the body for [ProjectsService.Create].
	CreateProjectParams = api.CreateProjectBodyJsonEncoding
	// CreateWebhookEndpointParams is the body for [WebhookEndpointsService.Create].
	CreateWebhookEndpointParams = api.CreateWebhookBodyJsonEncoding
	// UpdateWebhookEndpointParams is the body for [WebhookEndpointsService.Update].
	UpdateWebhookEndpointParams = api.UpdateWebhookBodyJsonEncoding
)

// AuthSession describes the credential the client authenticates with and
// what it can use.
type AuthSession struct {
	// Kind is the credential's kind: "secret_key" for a project secret key,
	// "cli_key" for a CLI key, "mcp_client" or "dashboard_session".
	Kind string `json:"kind"`
	// Person is who the credential acts for, or nil for a project secret key.
	Person *AuthSessionPerson `json:"person"`
	// ConnectedAppID is the connected app an MCP client acts through, or nil.
	ConnectedAppID *string `json:"connectedAppId"`
	// IsReadOnly reports a credential that can only read.
	IsReadOnly    bool                      `json:"isReadOnly"`
	Organizations []AuthSessionOrganization `json:"organizations"`
	Projects      []AuthSessionProject      `json:"projects"`
}

// AuthSessionPerson is the person a credential acts for.
type AuthSessionPerson struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// AuthSessionOrganization is an organization visible to the session.
type AuthSessionOrganization struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// AuthSessionProject is a project visible to the session.
type AuthSessionProject struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	OrganizationID string `json:"organizationId"`
	Slug           string `json:"slug"`
}
