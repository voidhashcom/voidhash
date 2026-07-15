import { describe, expect, it } from "vitest";

import { decodeAgentClientMessage, encodeAgentServerMessage } from "../src/Protocol.ts";

describe("agent session protocol", () => {
  it("decodes versioned prompt messages with images", () => {
    const message = decodeAgentClientMessage(
      JSON.stringify({
        v: 1,
        requestId: "request-1",
        type: "prompt",
        text: "Review this",
        images: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }],
      }),
    );

    expect(message).toEqual({
      v: 1,
      requestId: "request-1",
      type: "prompt",
      text: "Review this",
      images: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }],
    });
  });

  it("rejects unknown versions and malformed commands", () => {
    expect(() =>
      decodeAgentClientMessage(JSON.stringify({ v: 2, requestId: "request-1", type: "abort" })),
    ).toThrow();
    expect(() =>
      decodeAgentClientMessage(JSON.stringify({ v: 1, requestId: "request-1", type: "prompt" })),
    ).toThrow();
  });

  it("encodes server events as JSON", () => {
    expect(
      JSON.parse(
        encodeAgentServerMessage({
          v: 1,
          type: "ack",
          requestId: "request-1",
          command: "abort",
        }),
      ),
    ).toEqual({ v: 1, type: "ack", requestId: "request-1", command: "abort" });
  });
});
