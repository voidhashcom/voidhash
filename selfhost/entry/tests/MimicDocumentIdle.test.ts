import {
  IDLE_DIRTY_SEQ_KEY,
  IDLE_NOTIFIED_SEQ_KEY,
  type MimicDocumentIdleMessageType,
} from "@voidhash/mimic-db/ws/idle-notify";
import { makeDurableEntityAddress } from "@voidhash/platform/DurableEntity";
import type { NodeDurableEntityControlShape } from "@voidhash/platform-node/DurableEntity";
import { makeMemoryDurableEntityHost } from "@voidhash/platform-node/MemoryDurableEntity";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { dispatchMimicDocumentIdleAlarms } from "../src/mimic/MimicNodeWebSocket.ts";

const address = makeDurableEntityAddress(
  "mimic-document",
  "collection-1:document-1",
);

const control: NodeDurableEntityControlShape = {
  listDueAlarms: () => Effect.succeed([{ address, scheduledTime: 0 }]),
};

describe("Mimic Node idle alarm dispatch", () => {
  it("publishes and records a persisted dirty revision", async () => {
    const entities = makeMemoryDurableEntityHost();
    const published: MimicDocumentIdleMessageType[] = [];
    await Effect.runPromise(
      entities.run(address, (entity) =>
        Effect.gen(function* () {
          yield* entity.keyValue.put(IDLE_DIRTY_SEQ_KEY, 7);
          yield* entity.keyValue.put(IDLE_NOTIFIED_SEQ_KEY, 4);
          yield* entity.alarm.set(0);
        }),
      ),
    );

    await Effect.runPromise(
      dispatchMimicDocumentIdleAlarms(
        entities,
        {
          control,
          debounceMs: 1,
          publish: (message) =>
            Effect.sync(() => {
              published.push(message);
            }),
        },
        () => 0,
      ),
    );

    expect(published).toEqual([
      { collectionId: "collection-1", documentId: "document-1", seq: 7 },
    ]);
    expect(
      await Effect.runPromise(
        entities.run(address, (entity) =>
          entity.keyValue.get(IDLE_NOTIFIED_SEQ_KEY),
        ),
      ),
    ).toBe(7);
    expect(
      await Effect.runPromise(
        entities.run(address, (entity) => entity.alarm.get),
      ),
    ).toBeUndefined();
  });

  it("consumes the alarm without publishing when a collaborator reconnected", async () => {
    const entities = makeMemoryDurableEntityHost();
    const published: MimicDocumentIdleMessageType[] = [];
    await Effect.runPromise(
      entities.run(address, (entity) =>
        Effect.gen(function* () {
          yield* entity.keyValue.put(IDLE_DIRTY_SEQ_KEY, 8);
          yield* entity.keyValue.put(IDLE_NOTIFIED_SEQ_KEY, 7);
          yield* entity.alarm.set(0);
        }),
      ),
    );

    await Effect.runPromise(
      dispatchMimicDocumentIdleAlarms(
        entities,
        {
          control,
          debounceMs: 1,
          publish: (message) =>
            Effect.sync(() => {
              published.push(message);
            }),
        },
        () => 1,
      ),
    );

    expect(published).toEqual([]);
    expect(
      await Effect.runPromise(
        entities.run(address, (entity) =>
          entity.keyValue.get(IDLE_NOTIFIED_SEQ_KEY),
        ),
      ),
    ).toBe(7);
    expect(
      await Effect.runPromise(
        entities.run(address, (entity) => entity.alarm.get),
      ),
    ).toBeUndefined();
  });
});
