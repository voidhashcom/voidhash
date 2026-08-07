import type { Db } from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import { Context, Effect, Layer, Schema } from "effect";

import { AnalyticsWriterService } from "../analyticsIngest/AnalyticsWriterService.ts";
import { QueueProducerError } from "../infrastructure/QueueProducer.ts";
import type { PersonIdentityEventV1, PersonSnapshotEventV1 } from "../../domain/person/Person.ts";

/**
 * Person-snapshot payload written into the analytics writer. Mirrors the shape
 * the analytics processor emits.
 */
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

/** Identity-mapping payload written into the analytics writer. */
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

/** Only the optional snapshot fields that actually carry a value. */
const personOptionalFields = (
  event: PersonSnapshotEventV1,
): Pick<
  Partial<ProcessorPersonEventV1>,
  "email" | "mergedIntoPersonId" | "name" | "primaryDistinctId"
> => {
  const fields: {
    email?: string;
    mergedIntoPersonId?: string;
    name?: string;
    primaryDistinctId?: string;
  } = {};
  if (event.email) fields.email = event.email;
  if (event.mergedIntoPersonId) fields.mergedIntoPersonId = event.mergedIntoPersonId;
  if (event.name) fields.name = event.name;
  if (event.primaryDistinctId) fields.primaryDistinctId = event.primaryDistinctId;
  return fields;
};

const toProcessorPersonEvent = (event: PersonSnapshotEventV1): ProcessorPersonEventV1 => ({
  changedAt: event.changedAt,
  personId: event.personId,
  isArchived: event.isArchived,
  projectId: event.projectId,
  schemaVersion: event.schemaVersion,
  traits: event.traits,
  version: event.version,
  ...personOptionalFields(event),
});

const toProcessorPersonIdentityEvent = ({
  identityDistinctId,
  mappingEvent,
}: {
  readonly identityDistinctId: string;
  readonly mappingEvent: PersonIdentityEventV1;
}): ProcessorPersonIdentityEventV1 => {
  const base = {
    changedAt: mappingEvent.changedAt,
    personId: mappingEvent.personId,
    isDeleted: mappingEvent.isDeleted,
    projectId: mappingEvent.projectId,
    schemaVersion: mappingEvent.schemaVersion,
    version: mappingEvent.version,
  };

  // A mapping event on the identity's own distinct id is not an alias, so it
  // carries no previous distinct id.
  if (!mappingEvent.distinctId || mappingEvent.distinctId === identityDistinctId) {
    return { ...base, distinctId: mappingEvent.distinctId };
  }

  return {
    ...base,
    distinctId: identityDistinctId,
    previousDistinctId: mappingEvent.distinctId,
  };
};

/**
 * Publishes identity projection events produced outside the capture flush
 * batch. The analytics ingest path uses {@link noop} because its processor
 * returns these events to its batch writer; the SDK composition uses
 * {@link analyticsWriterLayer} for direct ClickHouse writes.
 */
export class IdentityProjectionPublisher extends Context.Service<
  IdentityProjectionPublisher,
  {
    readonly publishIdentityResult: (
      input: IdentityProjectionInput,
    ) => Effect.Effect<void, QueueProducerError, Db>;
  }
>()("IdentityProjectionPublisher", {
  make: Effect.sync(() => {
    return { publishIdentityResult: () => Effect.void };
  }),
}) {
  static readonly layer = Layer.effect(IdentityProjectionPublisher)(
    IdentityProjectionPublisher.make,
  );

  static readonly analyticsWriterLayer = Layer.effect(
    IdentityProjectionPublisher,
    Effect.gen(function* () {
      const writer = yield* AnalyticsWriterService;

      return {
        publishIdentityResult: (input) => {
          const personMessages = input.personEvents.map(toProcessorPersonEvent);
          const identityMessages = input.mappingEvents.map((mappingEvent) =>
            toProcessorPersonIdentityEvent({
              identityDistinctId: input.identity.distinctId,
              mappingEvent,
            }),
          );

          return writer
            .writeMessages([
              ...personMessages.map((person) => ({
                kind: constant("person"),
                messageId: `${person.projectId}:${person.personId}:${person.version}`,
                value: person,
              })),
              ...identityMessages.map((identity) => ({
                kind: constant("person-distinct-id"),
                messageId: `${identity.projectId}:${identity.distinctId}:${identity.version}`,
                value: identity,
              })),
            ])
            .pipe(
              Effect.asVoid,
              Effect.mapError(
                (error) =>
                  new QueueProducerError({
                    cause: error.cause,
                    queueName: "AnalyticsWriterService",
                  }),
              ),
            );
        },
      };
    }),
  );

  /** No-op variant used by tests and capture flush paths that return outputs directly. */
  static readonly noop: Layer.Layer<IdentityProjectionPublisher> = Layer.succeed(
    IdentityProjectionPublisher,
    {
      publishIdentityResult: () => Effect.void,
    },
  );
}
