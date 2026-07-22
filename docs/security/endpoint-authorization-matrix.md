# Endpoint Authorization Matrix

Status: alpha coverage inventory<br>
Last updated: 2026-07-14

This inventory covers every Community HTTP API and RPC operation plus the raw
routes mounted by `BackendApp`. A test compares the marked operation lists with
the live API contracts, so adding or removing a contract operation requires an
explicit authorization review here.

All management HTTP and RPC operations first require a server-established
`AuthSession`. Resource services then authorize the organization/project loaded
from storage; callers do not gain scope merely by supplying an ID. “Integrated”
means the service has database-backed forbidden/cross-tenant evidence. “Unit”
means the boundary is tested with controlled collaborators but still needs a
database-backed cross-tenant case. “Gap” is a publication blocker.

## HTTP API contract

<!-- HTTP_OPERATIONS_START -->
| Group | Operations |
| --- | --- |
| auth | `auth.session` |
| api_keys | `api_keys.createSecretKey`, `api_keys.listApiKeys`, `api_keys.getApiKeyById`, `api_keys.rotateSecretKey`, `api_keys.deleteApiKey` |
| persons | `persons.createPerson`, `persons.listPersons`, `persons.getPersonById`, `persons.getPersonByDistinctId` |
| notifications | `notifications.sendNotification` |
| organizations | `organizations.createOrganization` |
| perks | `perks.listPerks` |
| paywall_deploys | `paywall_deploys.createDeploy`, `paywall_deploys.uploadBlob`, `paywall_deploys.finalizeDeploy` |
| paywall_locations | `paywall_locations.listPaywallLocations` |
| schema | `schema.getSchema`, `schema.getSchemaVersion` |
| projects | `projects.createProject`, `projects.listProjects` |
| products | `products.listProducts` |
| product_perks | `product_perks.listProductPerksByProductId` |
| sdk | `sdk.getPerson`, `sdk.identifyPerson`, `sdk.syncPersonAttributes`, `sdk.syncTransaction`, `sdk.evaluateFeatureFlags`, `sdk.resolvePaywall`, `sdk.getSchema`, `sdk.registerDevice`, `sdk.refreshDevice`, `sdk.unregisterDevice` |
| users | `users.getUser` |
| payment_provider_configurations | `payment_provider_configurations.listPaymentProviderConfigurations` |
| payment_provider_products | `payment_provider_products.listPaymentProviderProducts` |
| webhooks | `webhooks.createWebhookEndpoint`, `webhooks.listWebhookEndpoints`, `webhooks.getWebhookEndpoint`, `webhooks.updateWebhookEndpoint`, `webhooks.deleteWebhookEndpoint`, `webhooks.rotateWebhookSecret`, `webhooks.testWebhookEndpoint`, `webhooks.listWebhookDeliveries`, `webhooks.getWebhookDelivery`, `webhooks.retryWebhookDelivery` |
<!-- HTTP_OPERATIONS_END -->

| Groups | Principal and authorization boundary | Evidence | Status |
| --- | --- | --- | --- |
| auth, users | User session; identity comes from the authenticated session, not request IDs. | `LocalUserSessionService.integration.test.ts`, `UserAuthorization.integration.test.ts`, `UserService.test.ts` | Integrated |
| api_keys | User/project session plus project permission; key IDs are reloaded and ownership checked. | `ApiKeyService.integration.test.ts` | Integrated |
| persons | Project-scoped session; person/distinct IDs are resolved and checked against that project. | `PersonService.integration.test.ts` | Integrated |
| notifications | Project ID is derived from a non-publishable authenticated session; downstream audience lookups stay project-scoped. | Notification authorization integration suite plus person/token service isolation tests | Integrated |
| organizations, projects | User membership plus organization/project permissions. | `OrganizationService.integration.test.ts`, `ProjectService.integration.test.ts` | Integrated |
| perks, products, product_perks | Project permission plus stored ownership of nested product/perk IDs. | `PerkService.integration.test.ts`, `ProductService.integration.test.ts`, `ProductPerkService.integration.test.ts` | Integrated |
| paywall_deploys, paywall_locations | Project permission plus stored paywall/release/location ownership. | `PaywallDeployService.integration.test.ts`, `PaywallLocationService.integration.test.ts` | Integrated |
| schema | Project permission before schema assembly/cache access. | `SchemaService.integration.test.ts` | Integrated |
| sdk | Publishable-key session elevated only to its resolved project/person; submitted IDs cannot select another project. | `SdkService.integration.test.ts`, `FeatureFlagService.integration.test.ts`, purchase-processing integration suites | Integrated |
| payment provider groups | Project permission plus stored configuration/product ownership. | Payment-provider configuration/product integration suites | Integrated |
| webhooks | Project permission plus stored endpoint/delivery ownership. | `WebhookManagerService.integration.test.ts`, webhook delivery/dispatch integration suites | Integrated |

## RPC contract

<!-- RPC_OPERATIONS_START -->
| Group | Operations |
| --- | --- |
| AgentSession | `ListAgentSessions`, `GetAgentSession`, `DeleteAgentSession`, `RevertAgentEditSession`, `UploadAgentAttachment` |
| Analytics | `ListRecentAnalyticsEvents`, `QueryAnalyticsInsights`, `QueryCustomAnalyticsInsight`, `QueryCustomAnalyticsPersons`, `ListAnalyticsInsights`, `CreateAnalyticsInsight`, `UpdateAnalyticsInsight`, `DeleteAnalyticsInsight`, `ListAnalyticsCohorts`, `CreateAnalyticsCohort`, `UpdateAnalyticsCohort`, `DeleteAnalyticsCohort`, `ListAnalyticsDashboards`, `CreateAnalyticsDashboard`, `DuplicateAnalyticsDashboard`, `UpdateAnalyticsDashboard`, `DeleteAnalyticsDashboard`, `PutAnalyticsDashboardItem`, `ReorderAnalyticsDashboardItems`, `RemoveAnalyticsDashboardItem` |
| ApiKey | `CreateSecretKey`, `ListApiKeys`, `GetApiKeyById`, `RotateSecretKey`, `DeleteApiKey`, `CreateUserApiKey`, `ListUserApiKeys`, `RevokeUserApiKey` |
| Person | `CreatePerson`, `ListPersons`, `GetPersonById`, `GetPersonByDistinctId` |
| Experiment | `ListExperiments`, `GetExperiment`, `CreateExperiment`, `UpdateExperiment`, `ReplaceExperimentVariants`, `UpsertExperimentTreatment`, `RemoveExperimentTreatment`, `StartExperiment`, `PauseExperiment`, `ConcludeExperiment`, `ArchiveExperiment`, `RestoreExperiment`, `GetExperimentResults` |
| FeatureFlag | `ListFeatureFlags`, `GetFeatureFlag`, `CreateFeatureFlag`, `UpdateFeatureFlag`, `ArchiveFeatureFlag`, `RestoreFeatureFlag`, `UpsertFeatureFlagOverride`, `ArchiveFeatureFlagOverride`, `ListFeatureFlagOverridesByFlag`, `ListFeatureFlagOverridesByPerson`, `UpsertFeatureFlagTarget`, `ArchiveFeatureFlagTarget`, `UpdateFeatureFlagVariants` |
| Feedback | `SubmitFeedback` |
| Organization | `CreateOrganization`, `UpdateOrganization`, `DeleteOrganization`, `SetOrganizationAvatar`, `RemoveOrganizationAvatar` |
| PaymentProviderConfiguration | `ListPaymentProviderConfigurations`, `GetPaymentProviderConfiguration`, `CreatePaymentProviderConfiguration`, `UpdatePaymentProviderConfiguration`, `DeletePaymentProviderConfiguration` |
| PaymentProviderProduct | `ListProviderProductsByProductId`, `CreatePaymentProviderProduct`, `UpdatePaymentProviderProduct`, `DeletePaymentProviderProduct`, `SetActivePaymentProviderProduct` |
| PushNotificationConfiguration | `ListPushNotificationConfigurations`, `GetPushNotificationConfiguration`, `CreatePushNotificationConfiguration`, `UpdatePushNotificationConfiguration`, `DeletePushNotificationConfiguration` |
| PushNotificationSend | `ListPushNotificationSends`, `GetPushNotificationSendDeliveries` |
| PaywallAsset | `UploadPaywallAsset`, `ListPaywallAssets`, `RenamePaywallAsset`, `DeletePaywallAsset` |
| PaywallComponent | `ListPaywallComponents`, `GetPaywallComponentVersions` |
| PaywallDeploy | `ListPaywallDeploys`, `SetActivePaywallRelease` |
| PaywallLocation | `ListPaywallLocations`, `CreatePaywallLocation`, `UpdatePaywallLocation`, `ArchivePaywallLocation`, `AssignPaywallLocationShowing`, `ClearPaywallLocationShowing`, `ListPaywallLocationShowings` |
| Paywall | `ListPaywalls`, `CreatePaywall`, `RenamePaywall`, `ArchivePaywall`, `RestorePaywall`, `DeletePaywall`, `RequestPaywallEditToken`, `CreatePaywallRelease`, `PublishPaywallRelease`, `GetPaywallDraftRelease` |
| PaywallWorkspace | `ListWorkspacePaywalls`, `ReadPaywallDocument`, `RecordComponentManifest` |
| Perk | `ListPerks`, `CreatePerk`, `DeletePerk` |
| ProductPerk | `ListProductPerksByProductId`, `CreateProductPerk`, `DeleteProductPerk` |
| Product | `ListProducts`, `GetProduct`, `CreateProduct`, `UpdateProduct`, `DeleteProduct` |
| Project | `CreateProject`, `ListProjects`, `UpdateProject`, `DeleteProject`, `SetProjectAvatar`, `RemoveProjectAvatar` |
| User | `CurrentUser`, `SetUserAvatar`, `RemoveUserAvatar` |
| VoidQl | `RunVoidQlQuery`, `ValidateVoidQlQuery`, `GetVoidQlSchema`, `SaveVoidQlInsight`, `ListVoidQlInsights`, `RunSavedVoidQlInsight`, `DeleteVoidQlInsight` |
| Webhook | `ListWebhookEndpoints`, `GetWebhookEndpoint`, `CreateWebhookEndpoint`, `UpdateWebhookEndpoint`, `DeleteWebhookEndpoint`, `RotateWebhookSecret`, `TestWebhookEndpoint`, `ListWebhookDeliveries`, `GetWebhookDelivery`, `RetryWebhookDelivery` |
<!-- RPC_OPERATIONS_END -->

| RPC groups | Authorization boundary | Evidence | Status |
| --- | --- | --- | --- |
| Analytics, VoidQl | Project permission before query compilation/execution; compiled SQL carries a bound tenant predicate. | Analytics integration suite and VoidQL compiler/substrate tests | Integrated |
| ApiKey, Person, Organization, PaymentProviderConfiguration, PaymentProviderProduct, PaywallDeploy, PaywallLocation, Paywall, Perk, ProductPerk, Product, Project, Webhook, FeatureFlag | Project/organization permission followed by stored ownership checks for nested IDs. | Corresponding database-backed core service integration suites | Integrated |
| PaywallComponent | Delegates to the project-authorized deploy service. | Paywall deploy integration suite | Integrated |
| AgentSession, PaywallAsset, PaywallWorkspace | Project membership/permission and stored parent ownership are checked before every read or mutation. Client-minted session ID collisions are bound to the persisted user and project scope. | `AgentSessionIndexService.test.ts`, `agent-session-rpcs.test.ts`, `PaywallAssetAuthorization.integration.test.ts`, `PaywallWorkspaceAuthorization.integration.test.ts`, plus service and RPC unit tests | Integrated |
| User, Feedback | Acting user comes only from the authenticated session; feedback project context derives its organization from the same session project. | `UserAuthorization.integration.test.ts`, `FeedbackAuthorization.integration.test.ts`, plus service tests | Integrated |
| Experiment | Project permission is checked on the stored experiment before every aggregate, variant, treatment, and lifecycle mutation. | `ExperimentService.authorization.integration.test.ts` covers every management operation and verifies no mutation. | Integrated |
| PushNotificationConfiguration, PushNotificationSend | Project permission plus stored configuration/send ownership; delivery lookup binds both project and parent send ID. | `NotificationsAuthorization.integration.test.ts` covers every configuration/history operation and a nested foreign send ID. | Integrated |

## Raw routes

| Surface | Principal or capability | Authorization/authenticity boundary | Status |
| --- | --- | --- | --- |
| `/rpc` | User API key, project secret key, or WorkOS session | Shared auth middleware creates the session consumed by every RPC. | Covered by RPC smoke and service evidence above |
| `/api/mcp` | Bearer project secret key or user API key | Secret keys select their project directly. User keys select an accessible project by header, or default only when exactly one is accessible. Workspace services re-check the requested paywall/project. | Route/protocol tests plus integrated cross-project workspace evidence |
| `/api/agent/sessions/:id/ws` | Authenticated user/session token | The upgrade route verifies organization/project membership, then durable ownership binds the session ID to that user and project. | Node WebSocket integration tests, workerd Durable Object probe, and session-core ownership tests |
| `/i/v1/capture`, `/i/v1/batch` | Publishable project token | Token resolves the project; processing rejects route/project mismatch and reserved events. | Integrated |
| Stripe webhook | Provider signature over exact raw body and timestamp | Configuration lookup is tied to the route ID; ledger IDs deduplicate. | Integrated |
| WorkOS webhook | Provider signature over exact raw body and timestamp | External event ID uniqueness and membership sync rules. | Integrated |
| Apple webhook | Signed JWS and application identity | Provider configuration, full signature/certificate verification, notification UUID uniqueness, and purchase-ledger idempotency. | Integrated cryptographic fixtures and database replay/dedup evidence; independent review pending |
| Google Play RTDN | Google OIDC signature, issuer, lifetime, audience, verified service-account email | Provider configuration, authoritative Google Play state re-fetch, notification/ledger uniqueness. | Integrated; independent review pending |
| `/p/*`, `/c/*`, `/files/*` | Public content hash/object key | Only immutable public artifacts; traversal rejected and active HTML sandboxed. | Boundary tests and release smoke covered |
| `/health`, `/api/health`, OpenAPI | Public | No tenant data or mutation. | Smoke covered |

## Publication gates

The endpoint inventory and automated cross-tenant evidence are complete. The
remaining publication gates are the real beta traffic/security-log review and
independent security review recorded in the threat model. Repository visibility
must remain private until those process gates are complete.
