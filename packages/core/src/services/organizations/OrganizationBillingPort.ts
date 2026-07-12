import { Context, Effect, Layer, Schema } from "effect";

/** Stable error exposed by organization billing extensions to the core organization service. */
export class OrganizationBillingPortError extends Schema.TaggedErrorClass<OrganizationBillingPortError>(
  "OrganizationBillingPortError",
)("OrganizationBillingPortError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface OrganizationBillingPortShape {
  /** Provisions the optional billing extension for a newly created organization. */
  readonly initializeOrganizationBilling: (input: {
    readonly organizationId: string;
    readonly email?: string;
  }) => Effect.Effect<void, OrganizationBillingPortError>;
}

/** Optional extension point invoked after core creates an organization. */
export class OrganizationBillingPort extends Context.Service<
  OrganizationBillingPort,
  OrganizationBillingPortShape
>()("@voidhash/core/OrganizationBillingPort") {
  /** Community layer for deployments without platform billing. */
  static readonly noop: Layer.Layer<OrganizationBillingPort> = Layer.succeed(
    OrganizationBillingPort,
    {
      initializeOrganizationBilling: () => Effect.void,
    },
  );
}
