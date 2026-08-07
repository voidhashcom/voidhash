import { Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { AgentEditSessionTracker } from "./WorkspaceAgentTools.ts";

/** Mirrors the JSON body `begin_paywall_edit` reports as its tool output. */
const encodeEditSessionOutput = Schema.encodeSync(
  Schema.fromJsonString(Schema.Struct({ editSessionId: Schema.String, paywallId: Schema.String })),
);

describe("AgentEditSessionTracker", () => {
  it("accepts scoped calls only after begin_paywall_edit opens the session", () => {
    const tracker = new AgentEditSessionTracker();
    tracker.observe(
      "begin_paywall_edit",
      { paywallId: "pw_1" },
      {
        output: encodeEditSessionOutput({ editSessionId: "edit-1", paywallId: "pw_1" }),
        isError: false,
      },
    );

    return expect(
      Effect.runPromise(tracker.prepare("edit_paywall", { editSessionId: "edit-1", edits: [] })),
    ).resolves.toMatchObject({ editSessionId: "edit-1" });
  });

  it("rejects model-supplied edit sessions not owned by the durable session", () => {
    const tracker = new AgentEditSessionTracker();
    return expect(
      Effect.runPromise(
        tracker.prepare("edit_paywall", { editSessionId: "edit-attacker", edits: [] }),
      ),
    ).rejects.toThrow("not owned");
  });

  it("clears the capability only after a successful finish or revert", () => {
    const tracker = new AgentEditSessionTracker();
    tracker.observe(
      "begin_paywall_edit",
      { paywallId: "pw_1" },
      {
        output: encodeEditSessionOutput({ editSessionId: "edit-1", paywallId: "pw_1" }),
        isError: false,
      },
    );

    tracker.observe(
      "finish_paywall_edit",
      { editSessionId: "edit-1" },
      { output: "no", isError: true },
    );
    expect(tracker.get("pw_1")).toBe("edit-1");
    tracker.observe(
      "revert_paywall_edit",
      { editSessionId: "edit-1" },
      { output: "ok", isError: false },
    );
    expect(tracker.get("pw_1")).toBeUndefined();
  });

  it("rehydrates an unfinished capability from persisted Pi tool results", () => {
    const tracker = new AgentEditSessionTracker();
    tracker.rehydrate([
      {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "edit_paywall",
        content: [{ type: "text", text: "Updated" }],
        details: {
          toolName: "edit_paywall",
          output: "Updated",
          editSessionId: "edit-1",
          paywallId: "pw_1",
        },
        isError: true,
        timestamp: 1,
      },
    ]);
    return expect(
      Effect.runPromise(tracker.prepare("edit_paywall", { editSessionId: "edit-1", edits: [] })),
    )
      .resolves.toMatchObject({ editSessionId: "edit-1" })
      .then(() => {
        tracker.rehydrate([
          {
            role: "toolResult",
            toolCallId: "call-1",
            toolName: "edit_paywall",
            content: [{ type: "text", text: "Updated" }],
            details: {
              toolName: "edit_paywall",
              output: "Updated",
              editSessionId: "edit-1",
              paywallId: "pw_1",
            },
            isError: false,
            timestamp: 1,
          },
          {
            role: "toolResult",
            toolCallId: "call-2",
            toolName: "finish_paywall_edit",
            content: [{ type: "text", text: "Finished" }],
            details: {
              toolName: "finish_paywall_edit",
              output: "Finished",
              editSessionId: "edit-1",
              paywallId: "pw_1",
            },
            isError: false,
            timestamp: 2,
          },
        ]);
        expect(tracker.get("pw_1")).toBeUndefined();
      });
  });
});
