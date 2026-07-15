import { describe, expect, it } from "vite-plus/test";

import type { DesignerStoreState } from "../designer-store-state";
import { selectAiWorking } from "./ai-working";

const state = (localIsWorking: boolean, participant?: "agent" | "human") =>
  ({
    ai: { localIsWorking },
    mimic: {
      presence: {
        others: new Map(
          participant === undefined
            ? []
            : [["participant", { data: { participant: { kind: participant } } }]],
        ),
      },
    },
  }) as unknown as DesignerStoreState;

describe("selectAiWorking", () => {
  it("stays active while either the local chat or a connected agent is active", () => {
    expect(selectAiWorking(state(false))).toBe(false);
    expect(selectAiWorking(state(true))).toBe(true);
    expect(selectAiWorking(state(false, "human"))).toBe(false);
    expect(selectAiWorking(state(false, "agent"))).toBe(true);
  });
});
