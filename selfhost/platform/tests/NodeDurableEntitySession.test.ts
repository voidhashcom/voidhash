import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeNodeDurableEntitySession } from "../src/NodeDurableEntitySession.ts";

describe("Node durable entity session", () => {
  it("forwards socket operations and keeps attachments", async () => {
    const sent: Array<string | Uint8Array> = [];
    const closed: Array<readonly [number | undefined, string | undefined]> = [];
    const session = makeNodeDurableEntitySession(
      "session-1",
      {
        send: (message) => void sent.push(message),
        close: (code, reason) => void closed.push([code, reason]),
      },
      { authenticated: false },
    );

    await Effect.runPromise(session.send("hello"));
    await Effect.runPromise(session.setAttachment({ authenticated: true }));
    await Effect.runPromise(session.close(1000, "done"));

    expect(sent).toEqual(["hello"]);
    expect(await Effect.runPromise(session.getAttachment)).toEqual({ authenticated: true });
    expect(closed).toEqual([[1000, "done"]]);
  });
});
