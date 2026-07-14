import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_AI_MODEL, messagesContainImage, modelForTurn, VISION_AI_MODEL } from "./models.ts";

describe("modelForTurn", () => {
  it("keeps text-only designer turns on the code model", () => {
    const messages = [{ role: "user", parts: [{ type: "text", text: "Improve this" }] }];
    expect(messagesContainImage(messages)).toBe(false);
    expect(modelForTurn("designer", messages)).toBe(DEFAULT_AI_MODEL);
  });

  it("selects the vision model for a user image attachment", () => {
    const messages = [
      {
        role: "user",
        parts: [{ type: "file", mediaType: "image/png", url: "data:image/png;base64,cG5n" }],
      },
    ];
    expect(messagesContainImage(messages)).toBe(true);
    expect(modelForTurn("designer", messages)).toBe(VISION_AI_MODEL);
  });

  it("selects the vision model for a screenshot nested in a tool result", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          {
            type: "tool-get_preview_screenshot",
            state: "output-available",
            output: {
              kind: "preview-screenshot",
              mediaType: "image/png",
              dataBase64: "cG5n",
            },
          },
        ],
      },
    ];
    expect(messagesContainImage(messages)).toBe(true);
    expect(modelForTurn("designer", messages)).toBe(VISION_AI_MODEL);
  });
});
