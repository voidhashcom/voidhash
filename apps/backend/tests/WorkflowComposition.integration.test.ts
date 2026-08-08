// oxlint-disable-next-line effect/noNodeBuiltinImport -- the test stands up a real `node:http` server to receive live requests; an `HttpServer` layer would not exercise the same wire path.
import { createServer } from "node:http";

import { DeliverWebhookRegistration } from "@voidhash/core/workflows/DeliverWebhook";
import { DeliverWebhook } from "@voidhash/core/workflows/definitions";
import { generateId } from "@voidhash/core/utils/generate-id";
import {
  Db,
  WebhookDeliveryStatus,
  eq,
  sql,
  webhookDeliveries,
  webhookDeliveryAttempts,
  webhookEndpoints,
} from "@voidhash/db";
import { Clock, Data, DateTime, Effect, Layer, Schema } from "effect";
import * as Workflow from "@voidhash/platform/Workflow";
import { describe, expect, it } from "vitest";

import { makeSelfhostPlatformLayers } from "../src/backend/PlatformProfile.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

class TestServerAddressError extends Data.TaggedError("TestServerAddressError")<{
  readonly message: string;
}> {}

const WebhookPayload = Schema.Struct({ deliveryId: Schema.String });
const encodeWebhookPayload = Schema.encodeSync(Schema.fromJsonString(WebhookPayload));

describe("self-host workflow composition", () => {
  it("delivers a webhook through the durable cluster runner", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const receivedBodies: string[] = [];
        const server = createServer((request, response) => {
          const chunks: Buffer[] = [];
          request.on("data", (chunk: Buffer) => chunks.push(chunk));
          request.on("end", () => {
            receivedBodies.push(Buffer.concat(chunks).toString("utf8"));
            response.writeHead(204).end();
          });
        });
        yield* Effect.callback<void, Error>((resume) => {
          const onError = (error: Error) => resume(Effect.fail(error));
          server.once("error", onError);
          server.listen(0, "127.0.0.1", () => {
            server.off("error", onError);
            resume(Effect.void);
          });
        });

        const config = getSelfhostRuntimeConfig();
        const address = server.address();
        if (address === null || typeof address === "string") {
          return yield* new TestServerAddressError({
            message: "Test webhook receiver did not expose a TCP address",
          });
        }
        const suffix = generateId("test");
        const endpointId = `webhookEndpoint_${suffix}`;
        const deliveryId = `webhookDelivery_${suffix}`;
        const database = Db.layer(config.database);
        const platformDatabase = Db.layer(config.platformDatabase);
        const platform = makeSelfhostPlatformLayers(config);
        const workflowRuntime = Layer.merge(platform.workflowRunner, platform.runtime);

        const teardown = Effect.gen(function* () {
          yield* Effect.gen(function* () {
            const db = yield* Db;
            yield* db
              .delete(webhookDeliveryAttempts)
              .where(eq(webhookDeliveryAttempts.webhookDeliveryId, deliveryId));
            yield* db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId));
            yield* db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId));
          }).pipe(Effect.provide(database));
          yield* Effect.gen(function* () {
            const db = yield* Db;
            // The cluster workflow engine keeps no tables of its own: an
            // execution, its activities, its deferreds, and its durable clocks
            // are all rows in `cluster_messages` addressed to the same
            // `entity_id` (the hashed execution ID). Only the `run` row carries
            // the workflow payload, so it is what maps a delivery back to an
            // execution. Those rows live in the platform database, which is a
            // different connection from the application tables above.
            yield* db.execute(sql`
            DELETE FROM cluster_replies
            WHERE request_id IN (
              SELECT request_id FROM cluster_messages
              WHERE entity_id IN (
                SELECT entity_id FROM cluster_messages
                WHERE tag = 'run' AND payload::jsonb ->> 'deliveryId' = ${deliveryId}
              )
            )
          `);
            yield* db.execute(sql`
            DELETE FROM cluster_messages
            WHERE entity_id IN (
              SELECT entity_id FROM cluster_messages
              WHERE tag = 'run' AND payload::jsonb ->> 'deliveryId' = ${deliveryId}
            )
          `);
          }).pipe(Effect.provide(platformDatabase));
          yield* Effect.callback<void>((resume) => {
            server.close(() => resume(Effect.void));
          });
        }).pipe(Effect.orDie);

        return yield* Effect.gen(function* () {
          const occurredAt = yield* DateTime.nowAsDate;
          yield* Effect.gen(function* () {
            const db = yield* Db;
            yield* db.insert(webhookEndpoints).values({
              events: ["person.created"],
              id: endpointId,
              name: "workflow integration",
              projectId: `project_${suffix}`,
              secret: "whsec_integration",
              url: `http://127.0.0.1:${address.port}/webhook`,
            });
            yield* db.insert(webhookDeliveries).values({
              eventOccurredAt: occurredAt,
              eventType: "person.created",
              id: deliveryId,
              payload: { deliveryId },
              projectId: `project_${suffix}`,
              webhookEndpointId: endpointId,
            });
          }).pipe(Effect.provide(database));

          const attempts = yield* Effect.scoped(
            Effect.gen(function* () {
              yield* DeliverWebhookRegistration.register(database);
              yield* Workflow.execute(DeliverWebhook, {
                attemptNumber: 1,
                deliveryId,
                endpointId,
                eventType: "person.created",
                payload: { deliveryId },
                secret: "whsec_integration",
                url: `http://127.0.0.1:${address.port}/webhook`,
              });

              const db = yield* Db;
              const deadline = (yield* Clock.currentTimeMillis) + 10_000;
              while ((yield* Clock.currentTimeMillis) < deadline) {
                const row = yield* db.query.webhookDeliveries.findFirst({
                  where: { id: deliveryId },
                });
                if (row?.status === WebhookDeliveryStatus.Succeeded) {
                  return yield* db.query.webhookDeliveryAttempts.findMany({
                    where: { webhookDeliveryId: deliveryId },
                  });
                }
                yield* Effect.sleep("25 millis");
              }
              return yield* Effect.die("webhook workflow timed out");
            }).pipe(Effect.provide(database), Effect.provide(workflowRuntime)),
          );

          expect(receivedBodies).toEqual([encodeWebhookPayload({ deliveryId })]);
          expect(attempts).toHaveLength(1);
          expect(attempts[0]).toMatchObject({ attemptNumber: 1, statusCode: 204, succeeded: true });
        }).pipe(Effect.ensuring(teardown));
      }),
    ));
});
