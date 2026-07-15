import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { AgentChangeSetTracker } from "./WorkspaceAgentTools.ts";

describe("AgentChangeSetTracker", () => {
  it("opens once and injects the change set into subsequent lifecycle calls", async () => {
    const tracker = new AgentChangeSetTracker();
    let begins = 0;
    const begin = (slug: string) => {
      begins += 1;
      return Effect.succeed({
        output: JSON.stringify({ changeSetId: "change-1", slug }),
        isError: false,
      });
    };

    await expect(
      Effect.runPromise(tracker.prepare("edit_paywall", { slug: "trial", edits: [] }, begin)),
    ).resolves.toMatchObject({ changeSetId: "change-1" });
    await expect(
      Effect.runPromise(tracker.prepare("get_paywall_preview", { slug: "trial" }, begin)),
    ).resolves.toEqual({ slug: "trial", changeSetId: "change-1" });
    expect(begins).toBe(1);
  });

  it("overwrites model-supplied capabilities with the session-owned change set", async () => {
    const tracker = new AgentChangeSetTracker();
    let begins = 0;
    const prepared = await Effect.runPromise(
      tracker.prepare(
        "edit_paywall",
        { slug: "trial", changeSetId: "change-attacker", edits: [] },
        (slug) => {
          begins += 1;
          return Effect.succeed({
            output: JSON.stringify({ changeSetId: "change-owned", slug }),
            isError: false,
          });
        },
      ),
    );

    expect(prepared).toMatchObject({ changeSetId: "change-owned" });
    expect(tracker.get("trial")).toBe("change-owned");
    expect(begins).toBe(1);
  });

  it("clears the capability only after a successful finish or revert", async () => {
    const tracker = new AgentChangeSetTracker();
    tracker.observe(
      "begin_paywall_edit",
      { slug: "trial" },
      {
        output: JSON.stringify({ changeSetId: "change-1", slug: "trial" }),
        isError: false,
      },
    );

    tracker.observe("finish_paywall_edit", { slug: "trial" }, { output: "no", isError: true });
    expect(tracker.get("trial")).toBe("change-1");
    tracker.observe(
      "revert_paywall_edit",
      { changeSetId: "change-1" },
      { output: "ok", isError: false },
    );
    expect(tracker.get("trial")).toBeUndefined();
  });

  it("rehydrates an unfinished capability from persisted Pi tool results", async () => {
    const tracker = new AgentChangeSetTracker();
    tracker.rehydrate([
      {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "edit_paywall",
        content: [{ type: "text", text: "Updated" }],
        details: {
          toolName: "edit_paywall",
          output: "Updated",
          changeSetId: "change-1",
          slug: "trial",
        },
        isError: true,
        timestamp: 1,
      },
    ]);
    let begins = 0;

    await expect(
      Effect.runPromise(
        tracker.prepare("edit_paywall", { slug: "trial", edits: [] }, () => {
          begins += 1;
          return Effect.succeed({ output: "unexpected", isError: true });
        }),
      ),
    ).resolves.toMatchObject({ changeSetId: "change-1" });
    expect(begins).toBe(0);

    tracker.rehydrate([
      {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "edit_paywall",
        content: [{ type: "text", text: "Updated" }],
        details: {
          toolName: "edit_paywall",
          output: "Updated",
          changeSetId: "change-1",
          slug: "trial",
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
          changeSetId: "change-1",
          slug: "trial",
        },
        isError: false,
        timestamp: 2,
      },
    ]);
    expect(tracker.get("trial")).toBeUndefined();
  });
});
