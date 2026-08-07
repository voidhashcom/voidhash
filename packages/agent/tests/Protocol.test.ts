import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { decodeAgentClientMessage, encodeAgentServerMessage } from "../src/Protocol.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

describe("agent session protocol", () => {
  it("decodes versioned prompt messages with images", () => {
    const message = decodeAgentClientMessage(
      encodeJson({
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
      decodeAgentClientMessage(encodeJson({ v: 2, requestId: "request-1", type: "abort" })),
    ).toThrow();
    expect(() =>
      decodeAgentClientMessage(encodeJson({ v: 1, requestId: "request-1", type: "prompt" })),
    ).toThrow();
  });

  it("encodes server events as JSON", () => {
    expect(
      decodeJson(
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
