import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeNodeDurableEntitySession } from "../src/NodeDurableEntitySession.ts";

describe("Node durable entity session", () => {
  it("forwards socket operations and keeps attachments", () =>
    Effect.runPromise(
      Effect.gen(function* () {
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

        yield* session.send("hello");
        yield* session.setAttachment({ authenticated: true });
        yield* session.close(1000, "done");

        const attachment = yield* session.getAttachment;

        expect(sent).toEqual(["hello"]);
        expect(attachment).toEqual({ authenticated: true });
        expect(closed).toEqual([[1000, "done"]]);
      }),
    ));
});
