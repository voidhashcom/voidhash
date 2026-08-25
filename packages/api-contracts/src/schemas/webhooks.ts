import { Schema } from "effect";

import { PageParams } from "../Pagination.ts";

/**
 * Names the tenant a webhook request addresses. Optional for a secret key,
 * which is scoped to exactly one project, and required for a credential that
 * spans several — otherwise the request is ambiguous and is rejected.
 */
export const WebhookScopeParams = Schema.Struct({
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "WebhookScopeParams" });

/**
 * Query parameters of `GET /webhooks/endpoints`. Endpoints carry no filterable
 * attribute beyond their project, so this is `PageParams` plus the tenant
 * address.
 */
export const WebhookEndpointListParams = Schema.Struct({
  ...PageParams.fields,
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "WebhookEndpointListParams" });

/**
 * Query parameters of `GET /webhooks/deliveries`. `endpointId` narrows the page
 * to the deliveries of a single endpoint, which is how a caller debugging one
 * subscription avoids paging through the whole project.
 */
export const WebhookDeliveryListParams = Schema.Struct({
  ...PageParams.fields,
  endpointId: Schema.optional(Schema.String),
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "WebhookDeliveryListParams" });

/**
 * Body of `POST /webhooks/endpoints`. `projectId` is optional for a secret key
 * and required otherwise. The response — and only that response — carries the
 * generated signing secret.
 */
export class CreateWebhookEndpointBody extends Schema.Class<CreateWebhookEndpointBody>(
  "CreateWebhookEndpointBody",
)({
  description: Schema.optional(Schema.String),
  events: Schema.Array(Schema.String),
  name: Schema.String,
  projectId: Schema.optional(Schema.String),
  url: Schema.String,
}) {}
