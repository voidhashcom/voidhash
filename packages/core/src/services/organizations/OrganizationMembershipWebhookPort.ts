import { Db } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

/** Stable failure boundary for an organization-membership webhook extension. */
export class OrganizationMembershipWebhookPortError extends Schema.TaggedErrorClass<OrganizationMembershipWebhookPortError>(
  "OrganizationMembershipWebhookPortError",
)("OrganizationMembershipWebhookPortError", { cause: Schema.String }) {}

export type OrganizationMembershipWebhookEvent =
  | {
      readonly _tag: "Upsert";
      readonly membership: {
        readonly externalId: string;
        readonly externalOrganizationId: string;
        readonly externalUserId: string;
        readonly role: string;
      };
    }
  | {
      readonly _tag: "Delete";
      readonly externalMembershipId: string;
    };

export interface OrganizationMembershipWebhookPortShape {
  readonly processEvent: (
    event: OrganizationMembershipWebhookEvent,
  ) => Effect.Effect<void, OrganizationMembershipWebhookPortError, Db>;
}

/** Optional extension point for projecting external multi-user membership webhooks. */
export class OrganizationMembershipWebhookPort extends Context.Service<
  OrganizationMembershipWebhookPort,
  OrganizationMembershipWebhookPortShape
>()("core/OrganizationMembershipWebhookPort") {
  /** Community layer that acknowledges membership events without projecting them. */
  static readonly noop: Layer.Layer<OrganizationMembershipWebhookPort> = Layer.succeed(
    OrganizationMembershipWebhookPort,
    OrganizationMembershipWebhookPort.of({ processEvent: () => Effect.void }),
  );
}
