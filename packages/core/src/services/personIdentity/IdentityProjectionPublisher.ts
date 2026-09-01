import type { Db } from "@voidhash/db";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type { PersonIdentityEventV1, PersonSnapshotEventV1 } from "../../domain/person/Person.ts";
import { QueueProducerError } from "../infrastructure/QueueProducer.ts";

/** Portable person snapshot shape consumed by hosted analytics projection. */
export const ProcessorPersonEventV1 = Schema.Struct({
  changedAt: Schema.String,
  personId: Schema.String,
  email: Schema.optional(Schema.String),
  isArchived: Schema.Boolean,
  mergedIntoPersonId: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  primaryDistinctId: Schema.optional(Schema.String),
  projectId: Schema.String,
  schemaVersion: Schema.Literal(1),
  traits: Schema.Record(Schema.String, Schema.Unknown),
  version: Schema.Number,
});
export type ProcessorPersonEventV1 = typeof ProcessorPersonEventV1.Type;

/** Portable person identity mapping consumed by hosted analytics projection. */
export const ProcessorPersonIdentityEventV1 = Schema.Struct({
  changedAt: Schema.String,
  personId: Schema.String,
  distinctId: Schema.String,
  isDeleted: Schema.Boolean,
  previousDistinctId: Schema.optional(Schema.String),
  projectId: Schema.String,
  schemaVersion: Schema.Literal(1),
  version: Schema.Number,
});
export type ProcessorPersonIdentityEventV1 = typeof ProcessorPersonIdentityEventV1.Type;

export interface IdentityProjectionInput {
  readonly identity: { readonly distinctId: string };
  readonly mappingEvents: ReadonlyArray<PersonIdentityEventV1>;
  readonly personEvents: ReadonlyArray<PersonSnapshotEventV1>;
}

/** Optional edition port for projecting identity mutations into analytics. */
export class IdentityProjectionPublisher extends Context.Service<
  IdentityProjectionPublisher,
  {
    readonly publishIdentityResult: (
      input: IdentityProjectionInput,
    ) => Effect.Effect<void, QueueProducerError, Db>;
  }
>()("IdentityProjectionPublisher", {
  make: Effect.sync(() => ({ publishIdentityResult: () => Effect.void })),
}) {
  static readonly layer = Layer.effect(IdentityProjectionPublisher)(
    IdentityProjectionPublisher.make,
  );

  /** Community implementation; PostgreSQL analytics does not project identity tables. */
  static readonly noop: Layer.Layer<IdentityProjectionPublisher> = Layer.succeed(
    IdentityProjectionPublisher,
    { publishIdentityResult: () => Effect.void },
  );
}
