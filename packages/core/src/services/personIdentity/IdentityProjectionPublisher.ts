import type { Db } from "@voidhash/db";
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

const toProcessorPersonEvent = (event: PersonSnapshotEventV1): ProcessorPersonEventV1 => ({
  changedAt: event.changedAt,
  personId: event.personId,
  ...(event.email ? { email: event.email } : {}),
  isArchived: event.isArchived,
  ...(event.mergedIntoPersonId ? { mergedIntoPersonId: event.mergedIntoPersonId } : {}),
  ...(event.name ? { name: event.name } : {}),
  ...(event.primaryDistinctId ? { primaryDistinctId: event.primaryDistinctId } : {}),
  projectId: event.projectId,
  schemaVersion: event.schemaVersion,
  traits: event.traits,
  version: event.version,
});

const toProcessorPersonIdentityEvent = ({
  identityDistinctId,
  mappingEvent,
}: {
  readonly identityDistinctId: string;
  readonly mappingEvent: PersonIdentityEventV1;
}): ProcessorPersonIdentityEventV1 => {
  const previousDistinctId =
    mappingEvent.distinctId === identityDistinctId ? undefined : mappingEvent.distinctId;

  return {
    changedAt: mappingEvent.changedAt,
    personId: mappingEvent.personId,
    distinctId: previousDistinctId ? identityDistinctId : mappingEvent.distinctId,
    isDeleted: mappingEvent.isDeleted,
    ...(previousDistinctId ? { previousDistinctId } : {}),
    projectId: mappingEvent.projectId,
    schemaVersion: mappingEvent.schemaVersion,
    version: mappingEvent.version,
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
                kind: "person" as const,
                messageId: `${person.projectId}:${person.personId}:${person.version}`,
                value: person,
              })),
              ...identityMessages.map((identity) => ({
                kind: "person-distinct-id" as const,
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
