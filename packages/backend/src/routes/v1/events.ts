import { AnalyticsEvent, VoidhashV1Api } from "@voidhash/api-contracts";
import { ApiActionForbiddenError, ApiAnalyticsServiceError } from "@voidhash/api-contracts/errors";
import { AnalyticsQuery } from "@voidhash/core-v2";
import { decodeCursor, encodeCursor, resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, requireCredential } from "../../ApiMiddlewares.ts";

/** Resolves an optional opaque cursor to the `eventId` it points at. */
const toAfterEventId = (cursor: string | undefined) => {
  if (cursor === undefined) return Effect.succeed(undefined);
  return decodeCursor(cursor);
};

export const EventsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "events", (handlers) =>
  Effect.gen(function* () {
    const analytics = yield* AnalyticsQuery;

    return handlers.handle("listEvents", ({ query }) =>
      bridgeAuthSession(
        Effect.gen(function* () {
          const authSession = yield* AuthSession;
          yield* requireCredential(authSession, ["user", "secret-key"]);
          const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
          const afterEventId = yield* toAfterEventId(query.cursor);
          const page = yield* analytics.listEventsPage({
            afterEventId,
            eventName: query.eventName,
            limit: query.limit,
            projectId,
          });
          const events = page.events.map(
            (row) =>
              new AnalyticsEvent({
                captureId: row.captureId,
                context: row.context,
                distinctId: row.distinctId,
                eventId: row.eventId,
                eventName: row.eventName,
                identityMode: row.identityMode,
                personId: row.personId,
                previousDistinctId: row.previousDistinctId,
                processedAt: row.processedAt,
                properties: row.properties,
                receivedAt: row.receivedAt,
                requestId: row.requestId,
                source: row.source,
                timestamp: row.timestamp,
              }),
          );
          const last = events[events.length - 1];
          let endCursor: string | null = null;
          if (page.hasNextPage && last !== undefined) {
            endCursor = encodeCursor(last.eventId);
          }
          return { data: events, pageInfo: { endCursor, hasNextPage: page.hasNextPage } };
        }),
      ).pipe(
        Effect.catchTags({
          ActionForbiddenError: (e) =>
            Effect.fail(new ApiActionForbiddenError({ message: e.message })),
          AnalyticsQueryError: (e) => Effect.fail(new ApiAnalyticsServiceError({ cause: e.cause })),
        }),
      ),
    );
  }),
);
