import type { Action, DNF } from "@voidhash/mimic-schema";
import type { ViewSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { describe, expect, test } from "vite-plus/test";

import {
  clearSelectedStateIfDeleted,
  getSelectedStateIdForNode,
  mapStyleOverridesForSnapshot,
  resolveEffectiveAction,
  resolveEffectiveStyle,
  setSelectedStateIdForNode,
  stateStyleOverridesToRecord,
} from "./state-overrides";

function createCondition(): DNF {
  return {
    type: "or",
    value: [
      {
        type: "and",
        value: [
          {
            type: "equals",
            value: {
              left: { type: "literal", value: { key: "boolean", value: true } },
              right: {
                type: "literal",
                value: { key: "boolean", value: true },
              },
            },
          },
        ],
      },
    ],
  } as unknown as DNF;
}

function createNode(): ViewSnapshotNode {
  return {
    id: "node-1",
    parentId: "root",
    pos: "a0",
    type: "view",
    children: [],
    data: {
    interactions: [
      {
        id: "interaction-entry-1",
        value: {
          id: "interaction-value-1",
          trigger: { type: "click" },
          action: { type: "none" },
        },
      },
    ],
    linkedVariables: [],
    localVariables: [],
    name: "Node",
    style: {
      alignItems: "flex-start",
      alignSelf: "auto",
      backgroundColor: "rgba(255, 0, 0, 1)",
      backgroundEnabled: true,
      borderColor: "rgba(0, 0, 0, 1)",
      borderEnabled: false,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderStyle: "solid",
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
      borderTopWidth: 0,
      display: "flex",
      flexBasis: "auto",
      flexDirection: "column",
      flexGrow: 0,
      flexShrink: 1,
      gap: 0,
      height: 100,
      justifyContent: "flex-start",
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      opacity: 1,
      overflow: "visible",
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      safeAreaBottom: false,
      safeAreaTop: false,
      shadowRadius: 0,
      shadowColor: "rgba(0, 0, 0, 1)",
      shadowEnabled: false,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowOpacity: 1,
      width: 100,
      zIndex: 0,
    },
    states: [
      {
        id: "state-1",
        value: {
          id: "state-value-1",
          name: "Hovered",
          condition: createCondition(),
          overrides: {
            style: {
              backgroundColor: "rgba(0, 255, 0, 1)",
            },
            actions: [
              {
                id: "action-override-entry-1",
                value: {
                  interactionId: "interaction-entry-1",
                  action: { type: "close-paywall" },
                },
              },
            ],
          },
        },
      },
    ],
    },
  } as unknown as ViewSnapshotNode;
}

describe("state override utilities", () => {
  test("resolves selected state id only for the matching node", () => {
    expect(getSelectedStateIdForNode({ "node-1": "state-1" }, "node-1")).toBe("state-1");
    expect(getSelectedStateIdForNode({ "node-2": "state-1" }, "node-1")).toBeNull();
  });

  test("sets and clears selected state ids per node", () => {
    const selection = setSelectedStateIdForNode({}, "node-1", "state-1");
    expect(selection["node-1"]).toBe("state-1");
    const clearedSelection = setSelectedStateIdForNode(selection, "node-1", null);
    expect(clearedSelection["node-1"]).toBeUndefined();
  });

  test("clears node selection when selected state gets deleted", () => {
    const selection = { "node-1": "state-1", "node-2": "state-2" };
    const nextSelection = clearSelectedStateIfDeleted(selection, "node-1", "state-1");
    expect(nextSelection["node-1"]).toBeUndefined();
    expect(nextSelection["node-2"]).toBe("state-2");
  });

  test("resolves effective style by merging state overrides over base style", () => {
    const node = createNode();
    const style = resolveEffectiveStyle(node, "state-1");
    expect(style.backgroundColor).toBe("rgba(0, 255, 0, 1)");
    expect(style.width).toBe(100);
  });

  test("resolves effective action from state override", () => {
    const node = createNode();
    const defaultAction: Action = { type: "none" };

    const action = resolveEffectiveAction(node, "state-1", "interaction-entry-1", defaultAction);

    expect(action.type).toBe("close-paywall");
  });

  test("maps style override snapshots to mutable records", () => {
    const node = createNode();
    const state = node.data.states[0] ?? null;
    const stateRecord = stateStyleOverridesToRecord(state);
    const mappedRecord = mapStyleOverridesForSnapshot(state?.value?.overrides.style);

    expect(stateRecord.backgroundColor).toBe("rgba(0, 255, 0, 1)");
    expect(mappedRecord.backgroundColor).toBe("rgba(0, 255, 0, 1)");
  });
});
