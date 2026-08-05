import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { WebhookDeliveryWorkflow } from "@voidhash/core/services/webhookDispatch/WebhookDeliveryWorkflow";
import {
  Db,
  WebhookDeliveryStatus,
  eq,
  sql,
  webhookDeliveries,
  webhookDeliveryAttempts,
  webhookEndpoints,
} from "@voidhash/db";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  makeSelfhostWorkflowRuntimeLive,
  registerSelfhostWorkflows,
} from "../src/backend/WorkflowPorts.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

describe("self-host workflow composition", () => {
  it("delivers a webhook through the durable cluster runner", async () => {
    const receivedBodies: string[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        receivedBodies.push(Buffer.concat(chunks).toString("utf8"));
        response.writeHead(204).end();
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const config = getSelfhostRuntimeConfig();
    const address = server.address() as AddressInfo;
    const suffix = crypto.randomUUID();
    const endpointId = `webhookEndpoint_${suffix}`;
    const deliveryId = `webhookDelivery_${suffix}`;
    const database = Db.layer(config.database);
    const platformDatabase = Db.layer(config.platformDatabase);

    try {
      await Effect.runPromise(
        Effect.gen(function* () {
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
            eventOccurredAt: new Date(),
            eventType: "person.created",
            id: deliveryId,
            payload: { deliveryId },
            projectId: `project_${suffix}`,
            webhookEndpointId: endpointId,
          });
        }).pipe(Effect.provide(database)),
      );

      const attempts = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            yield* registerSelfhostWorkflows(config);
            const delivery = yield* WebhookDeliveryWorkflow;
            yield* delivery.dispatch({
              attemptNumber: 1,
              deliveryId,
              endpointId,
              eventType: "person.created",
              payload: { deliveryId },
              secret: "whsec_integration",
              url: `http://127.0.0.1:${address.port}/webhook`,
            });

            const db = yield* Db;
            const deadline = Date.now() + 10_000;
            while (Date.now() < deadline) {
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
          }).pipe(
            Effect.provide(database),
            Effect.provide(makeSelfhostWorkflowRuntimeLive(config)),
          ),
        ),
      );

      expect(receivedBodies).toEqual([JSON.stringify({ deliveryId })]);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({ attemptNumber: 1, statusCode: 204, succeeded: true });
    } finally {
      await Effect.runPromise(
        Effect.gen(function* () {
          const db = yield* Db;
          yield* db
            .delete(webhookDeliveryAttempts)
            .where(eq(webhookDeliveryAttempts.webhookDeliveryId, deliveryId));
          yield* db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId));
          yield* db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId));
        }).pipe(Effect.provide(database)),
      );
      await Effect.runPromise(
        Effect.gen(function* () {
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
        }).pipe(Effect.provide(platformDatabase)),
      );
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
