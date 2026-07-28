import { Context, Effect, Layer, Schema } from "effect";

/** Stable error exposed by organization lifecycle extensions to the core organization service. */
export class OrganizationLifecyclePortError extends Schema.TaggedErrorClass<OrganizationLifecyclePortError>(
  "OrganizationLifecyclePortError",
)("OrganizationLifecyclePortError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface OrganizationLifecyclePortShape {
  /** Invoked after core creates an organization so host deployments can provision extensions. */
  readonly organizationCreated: (input: {
    readonly organizationId: string;
    readonly email?: string;
  }) => Effect.Effect<void, OrganizationLifecyclePortError>;
}

/** Optional extension point invoked around organization lifecycle transitions. */
export class OrganizationLifecyclePort extends Context.Service<
  OrganizationLifecyclePort,
  OrganizationLifecyclePortShape
>()("@voidhash/core/OrganizationLifecyclePort") {
  /** Community layer for deployments without lifecycle extensions. */
  static readonly noop: Layer.Layer<OrganizationLifecyclePort> = Layer.succeed(
    OrganizationLifecyclePort,
    {
      organizationCreated: () => Effect.void,
    },
  );
}
