import { makeMemoryDurableEntityHost } from "./runtime/MemoryDurableEntity.ts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { agentSessionAddress } from "../src/AgentSessionCore.ts";
import {
  SESSION_LOG_CHUNK_BYTES,
  appendSessionLog,
  ensureSessionOwner,
  messagesFromSessionLog,
  readSessionLog,
} from "../src/SessionLog.ts";

describe("session log", () => {
  it("links entries into an append-only tree across size-bounded storage chunks", async () => {
    const host = makeMemoryDurableEntityHost();
    const address = agentSessionAddress("session-1");
    let id = 0;
    let now = 100;
    const largeText = "🙂".repeat(Math.ceil(SESSION_LOG_CHUNK_BYTES / 4) + 100);
    const entries = [
      {
        type: "message" as const,
        message: { role: "user" as const, content: largeText, timestamp: 1 },
      },
      {
        type: "message" as const,
        message: { role: "user" as const, content: "second", timestamp: 2 },
      },
    ];

    await Effect.runPromise(
      appendSessionLog(host, address, entries, {
        id: () => `entry-${++id}`,
        now: () => ++now,
      }),
    );
    const persisted = await Effect.runPromise(readSessionLog(host, address));

    expect(persisted).toHaveLength(2);
    expect(persisted[0]).toMatchObject({ id: "entry-1", parentId: null, timestamp: 101 });
    expect(persisted[0]).toMatchObject({
      message: { role: "user", content: largeText },
    });
    expect(persisted.at(-1)).toMatchObject({ id: "entry-2", parentId: "entry-1" });
    expect(messagesFromSessionLog(persisted)).toHaveLength(2);
  });

  it("atomically initializes and verifies immutable ownership", async () => {
    const host = makeMemoryDurableEntityHost();
    const address = agentSessionAddress("session-owner");
    const owner = { organizationId: "org", projectId: "project", userId: "user" };
    const equals = (left: typeof owner, right: typeof owner) =>
      JSON.stringify(left) === JSON.stringify(right);

    await expect(Effect.runPromise(ensureSessionOwner(host, address, owner, equals))).resolves.toBe(
      true,
    );
    await expect(
      Effect.runPromise(ensureSessionOwner(host, address, { ...owner, userId: "other" }, equals)),
    ).resolves.toBe(false);
  });
});
