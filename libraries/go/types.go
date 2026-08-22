package voidhash

import (
	"github.com/voidhashcom/voidhash-go/api"
)

// Domain types re-exported from the generated client for a flat import
// surface. They are aliases, so they always track the OpenAPI document.
type (
	// Person is a person record.
	Person = api.PersonJsonEncoding
	// APIKey is a secret key without its raw value.
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
	// ProductPerk links a product to a perk.
	ProductPerk = api.ProductPerkJsonEncoding
	// Perk is an entitlement perk definition.
	Perk = api.PerkJsonEncoding
	// PaywallLocation is a deployable paywall location.
	PaywallLocation = api.PaywallLocationJsonEncoding
	// ProjectSchema is the full runtime schema of a project.
	ProjectSchema = api.ProjectSchemaResponseJsonEncoding
	// SchemaVersion identifies the current schema revision.
	SchemaVersion = api.SchemaVersionJsonEncoding
	// User is the authenticated user.
	User = api.UserJsonEncoding
	// EntitlementGrant is a single entitlement grant for a person.
	EntitlementGrant = api.SdkEntitlementGrantJsonEncoding
	// WebhookEndpoint is a webhook endpoint registration.
	WebhookEndpoint = api.WebhookEndpointJsonEncoding
	// WebhookDelivery is one webhook delivery.
	WebhookDelivery = api.WebhookDeliveryJsonEncoding
	// WebhookDeliveryWithAttempts includes every attempt made for a delivery.
	WebhookDeliveryWithAttempts = api.WebhookDeliveryWithAttemptsJsonEncoding
	// Notification is an outbound push notification payload.
	Notification = api.SendNotificationBodyJsonEncoding
	// SendNotificationResponse acknowledges a notification send.
	SendNotificationResponse = api.SendNotificationResponseJsonEncoding

	// CreateAPIKeyParams is the body for [APIKeysService.Create].
	CreateAPIKeyParams = api.CreateSecretKeyBodyJsonEncoding
	// CreatePersonParams is the body for [PersonsService.Create].
	CreatePersonParams = api.CreatePersonBodyJsonEncoding
	// CreateOrganizationParams is the body for [OrganizationsService.Create].
	CreateOrganizationParams = api.CreateOrganizationBodyJsonEncoding
	// CreateProjectParams is the body for [ProjectsService.Create].
	CreateProjectParams = api.CreateProjectBodyJsonEncoding
	// CreateWebhookEndpointParams is the body for [WebhooksEndpointsService.Create].
	CreateWebhookEndpointParams = api.CreateWebhookEndpointBodyJsonEncoding
	// UpdateWebhookEndpointParams is the body for [WebhooksEndpointsService.Update].
	UpdateWebhookEndpointParams = api.UpdateWebhookEndpointBodyJsonEncoding
)

// AuthSession describes what the presented key can access.
type AuthSession struct {
	Method        string                    `json:"method"`
	Name          string                    `json:"name"`
	Organizations []AuthSessionOrganization `json:"organizations"`
	Projects      []AuthSessionProject      `json:"projects"`
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
