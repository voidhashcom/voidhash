import { HttpApi } from "effect/unstable/httpapi";

import {
  AnalyticsGroup,
  ApiKeysGroup,
  AuthGroup,
  DevelopmentGroup,
  EventsGroup,
  ExperimentsGroup,
  FeatureFlagOverridesGroup,
  FeatureFlagTargetsGroup,
  FeatureFlagsGroup,
  IngestPolicyGroup,
  NotificationSendsGroup,
  NotificationsGroup,
  OrganizationsGroup,
  PaymentProviderConfigurationsGroup,
  PaymentProviderProductsGroup,
  PaywallDeploysGroup,
  PaywallLocationsGroup,
  PaywallsGroup,
  PerksGroup,
  PersonsGroup,
  ProductsGroup,
  ProjectsGroup,
  PushNotificationConfigurationsGroup,
  SchemaGroup,
  SdkGroup,
  UsersGroup,
  WebhooksGroup,
} from "./groups/index.ts";

/**
 * The public Voidhash HTTP API.
 *
 * Groups live in `./groups/` — one module per resource family — and are
 * composed here so the OpenAPI document stays a single source of truth.
 *
 * ## `Location` on `201 Created`
 *
 * Every create that returns `201` also returns a `Location` header holding the
 * canonical `GET` for the new resource, as an absolute-path reference below
 * `/api/v1`. Handlers produce it with `createdResponse` (see `./Created.ts`),
 * which is the only supported way to attach a response header: `HttpApiEndpoint`
 * has no success-side `headers` option — its `headers` field is the *request*
 * header schema — and `HttpApiSchema` carries no response-header annotation, so
 * the header must ride on an `HttpServerResponse` returned by the handler
 * (`HttpApiEndpoint.Handler` types the success channel as
 * `Success | HttpServerResponse`, and `HttpApiBuilder` passes such a value
 * through unencoded). Where the canonical `GET` is project-scoped
 * (`/paywall-locations/:locationId`, `/webhooks/endpoints/:endpointId`) the
 * `projectId` the create resolved is appended, so the same credential can
 * follow the header without a 403.
 *
 * Four creates have no `Location`, because the resource they create has no
 * item-level `GET` to point at — only the collection it belongs to:
 * `feature_flag_overrides.upsertFeatureFlagOverride`,
 * `feature_flag_targets.upsertFeatureFlagTarget`, `products.attachProductPerk`
 * and `paywalls.createPaywallRelease`. Give any of them a `GET /:id` and the
 * header should follow.
 *
 * The header is not advertised in the generated OpenAPI document: effect's
 * `OpenApi.OpenApiSpecResponse` models a response as `description` + `content`
 * only, with no `headers` map, so no annotation can surface it to the generated
 * clients. It is a runtime-only affordance for direct HTTP consumers.
 */
export const VoidhashV1Api = HttpApi.make("VoidhashV1Api")
  .add(AnalyticsGroup)
  .add(ApiKeysGroup)
  .add(AuthGroup)
  .add(DevelopmentGroup)
  .add(EventsGroup)
  .add(ExperimentsGroup)
  .add(FeatureFlagOverridesGroup)
  .add(FeatureFlagTargetsGroup)
  .add(FeatureFlagsGroup)
  .add(IngestPolicyGroup)
  .add(NotificationSendsGroup)
  .add(NotificationsGroup)
  .add(OrganizationsGroup)
  .add(PaymentProviderConfigurationsGroup)
  .add(PaymentProviderProductsGroup)
  .add(PaywallDeploysGroup)
  .add(PaywallLocationsGroup)
  .add(PaywallsGroup)
  .add(PerksGroup)
  .add(PersonsGroup)
  .add(ProductsGroup)
  .add(ProjectsGroup)
  .add(PushNotificationConfigurationsGroup)
  .add(SchemaGroup)
  .add(SdkGroup)
  .add(UsersGroup)
  .add(WebhooksGroup)
  .prefix("/api/v1");
