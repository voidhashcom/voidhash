import { PathNode, ScreenNode, ShapeNode, TextNode, ViewNode } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../testing/offline-document";
import { findTypedNode } from "./node-proxies";
import {
  restorePathNodeData,
  restoreScreenNodeData,
  restoreShapeNodeData,
  restoreTextNodeData,
  restoreViewNodeData,
  updatePathNodeData,
  updateScreenNodeData,
  updateShapeNodeData,
  updateTextNodeData,
  updateViewNodeData,
} from "./node-data-writes";

const sampleCondition = {
  type: "or",
  value: [
    {
      type: "and",
      value: [
        {
          type: "equals",
          value: {
            left: { type: "literal", value: { key: "boolean", value: true } },
            right: { type: "literal", value: { key: "boolean", value: true } },
          },
        },
      ],
    },
  ],
} as const;

function makeDocument() {
  const doc = createOfflineDesignerDocument();
  const { screenId } = seededIds(doc);
  const ids = { flexId: "", pathId: "", screenId, shapeId: "", textId: "" };
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    const flex = screen.children.insertLast({ type: "view", name: "Card" });
    ids.flexId = flex.id;
    ids.textId = flex.children.insertLast({ type: "text", text: "Buy now" }).id;
    const shape = screen.children.insertLast({ type: "shape" });
    ids.shapeId = shape.id;
    ids.pathId = shape.children.insertLast({ type: "path", d: "M0 0h24v24H0z" }).id;
  });
  return { doc, ids };
}

function rawViewData(doc: OfflineDesignerDocument, nodeId: string) {
  const data = findTypedNode(doc.root, nodeId, ViewNode)?.get()?.data;
  if (data === undefined) {
    throw new Error("expected a flex node");
  }
  return data;
}

/**
 * Populates the flex node's array fields the way the editor does, so undo
 * round trips can prove the entries survive untouched.
 */
function populateFlexArrays(doc: OfflineDesignerDocument, flexId: string) {
  doc.transaction((root) => {
    const proxy = findTypedNode(root, flexId, ViewNode);
    if (!proxy) throw new Error("expected a flex node");
    proxy.data.interactions.push({
      action: { type: "close-paywall" },
      id: "interaction-1",
      trigger: { type: "click" },
    });
    proxy.data.states.push({
      condition: sampleCondition,
      id: "state-1",
      name: "Selected",
    });
    proxy.data.localVariables.push({
      id: "var-1",
      name: "selected",
      value: { key: "boolean", value: false },
    });
  });
}

describe("updateViewNodeData", () => {
  test("captures only the touched restorable fields and never the arrays", () => {
    const { doc, ids } = makeDocument();
    populateFlexArrays(doc, ids.flexId);

    const previous = doc.transaction((root) =>
      updateViewNodeData(root, ids.flexId, { name: "Renamed" }),
    );

    expect(previous).toEqual({ name: "Card" });
    expect(rawViewData(doc, ids.flexId).name).toBe("Renamed");
  });

  test("rename undo round trip leaves states/interactions/localVariables byte-identical", () => {
    const { doc, ids } = makeDocument();
    populateFlexArrays(doc, ids.flexId);

    const before = rawViewData(doc, ids.flexId);
    const beforeJson = {
      interactions: JSON.stringify(before.interactions),
      localVariables: JSON.stringify(before.localVariables),
      states: JSON.stringify(before.states),
    };

    const previous = doc.transaction((root) =>
      updateViewNodeData(root, ids.flexId, { name: "Renamed" }),
    );
    doc.transaction((root) => {
      restoreViewNodeData(root, ids.flexId, previous ?? {});
    });

    const after = rawViewData(doc, ids.flexId);
    expect(after.name).toBe("Card");
    expect(JSON.stringify(after.interactions)).toBe(beforeJson.interactions);
    expect(JSON.stringify(after.localVariables)).toBe(beforeJson.localVariables);
    expect(JSON.stringify(after.states)).toBe(beforeJson.states);
    // the historical corruption shape: entries re-wrapped as {id, pos, value: {id, pos, value}}
    const entryValue = after.interactions[0]?.value;
    expect(entryValue).toEqual({
      action: { type: "close-paywall" },
      id: "interaction-1",
      trigger: { type: "click" },
    });
  });

  test("style undo round trip restores the touched style and keeps arrays intact", () => {
    const { doc, ids } = makeDocument();
    populateFlexArrays(doc, ids.flexId);

    const beforeStyle = JSON.stringify(rawViewData(doc, ids.flexId).style);
    const beforeStates = JSON.stringify(rawViewData(doc, ids.flexId).states);

    const previous = doc.transaction((root) =>
      updateViewNodeData(root, ids.flexId, { style: { width: 240 } }),
    );
    expect(previous && Object.keys(previous)).toEqual(["style"]);
    expect(rawViewData(doc, ids.flexId).style.width).toBe(240);

    doc.transaction((root) => {
      restoreViewNodeData(root, ids.flexId, previous ?? {});
    });

    expect(JSON.stringify(rawViewData(doc, ids.flexId).style)).toBe(beforeStyle);
    expect(JSON.stringify(rawViewData(doc, ids.flexId).states)).toBe(beforeStates);
  });

  test("undo of a flex-introducing update deletes the field again", () => {
    const { doc, ids } = makeDocument();

    expect(rawViewData(doc, ids.flexId).style.flex).toBeUndefined();

    const previous = doc.transaction((root) =>
      updateViewNodeData(root, ids.flexId, { style: { flex: 1 } }),
    );
    expect(rawViewData(doc, ids.flexId).style.flex).toBe(1);

    doc.transaction((root) => {
      restoreViewNodeData(root, ids.flexId, previous ?? {});
    });
    expect(rawViewData(doc, ids.flexId).style.flex).toBeUndefined();
  });

  test("returns undefined for missing or differently-typed nodes", () => {
    const { doc, ids } = makeDocument();
    const missing = doc.transaction((root) => updateViewNodeData(root, "missing", {}));
    expect(missing).toBeUndefined();
    const wrongType = doc.transaction((root) => updateViewNodeData(root, ids.textId, {}));
    expect(wrongType).toBeUndefined();
  });
});

describe("updateScreenNodeData", () => {
  test("rename undo round trip leaves states/localVariables byte-identical", () => {
    const { doc, ids } = makeDocument();
    doc.transaction((root) => {
      const proxy = findTypedNode(root, ids.screenId, ScreenNode);
      if (!proxy) throw new Error("expected a screen node");
      proxy.data.states.push({ condition: sampleCondition, id: "state-1", name: "Selected" });
      proxy.data.localVariables.push({
        id: "var-1",
        name: "count",
        value: { key: "number", value: 3 },
      });
    });
    const screenNode = () => {
      const data = findTypedNode(doc.root, ids.screenId, ScreenNode)?.get()?.data;
      if (data === undefined) throw new Error("expected a screen node");
      return data;
    };
    const beforeStates = JSON.stringify(screenNode().states);
    const beforeVariables = JSON.stringify(screenNode().localVariables);

    const previous = doc.transaction((root) =>
      updateScreenNodeData(root, ids.screenId, { name: "Onboarding" }),
    );
    doc.transaction((root) => {
      restoreScreenNodeData(root, ids.screenId, previous ?? {});
    });

    expect(screenNode().name).toBe("Screen");
    expect(JSON.stringify(screenNode().states)).toBe(beforeStates);
    expect(JSON.stringify(screenNode().localVariables)).toBe(beforeVariables);
  });
});

describe("updateTextNodeData", () => {
  test("text and name undo round trip restores both fields", () => {
    const { doc, ids } = makeDocument();
    const textNode = () => {
      const data = findTypedNode(doc.root, ids.textId, TextNode)?.get()?.data;
      if (data === undefined) throw new Error("expected a text node");
      return data;
    };

    const previous = doc.transaction((root) =>
      updateTextNodeData(root, ids.textId, { name: "CTA", text: "Subscribe" }),
    );
    expect(previous).toEqual({ name: "Text", text: "Buy now" });
    expect(textNode().text).toBe("Subscribe");

    doc.transaction((root) => {
      restoreTextNodeData(root, ids.textId, previous ?? {});
    });
    expect(textNode().name).toBe("Text");
    expect(textNode().text).toBe("Buy now");
  });
});

describe("updatePathNodeData", () => {
  test("d and transform undo round trip restores both fields", () => {
    const { doc, ids } = makeDocument();
    const pathNode = () => {
      const data = findTypedNode(doc.root, ids.pathId, PathNode)?.get()?.data;
      if (data === undefined) throw new Error("expected a path node");
      return data;
    };

    const previous = doc.transaction((root) =>
      updatePathNodeData(root, ids.pathId, { d: "M1 1h2v2H1z", transform: "scale(2)" }),
    );
    // an absent transform snapshots as undefined and restores as a deletion
    expect(previous).toEqual({ d: "M0 0h24v24H0z", transform: undefined });
    expect(previous && Object.keys(previous).sort()).toEqual(["d", "transform"]);

    doc.transaction((root) => {
      restorePathNodeData(root, ids.pathId, previous ?? {});
    });
    expect(pathNode().d).toBe("M0 0h24v24H0z");
    expect(pathNode().transform).toBeUndefined();
  });
});

describe("updateShapeNodeData", () => {
  test("svgSource and viewBox undo round trip restores both fields", () => {
    const { doc, ids } = makeDocument();
    const shapeNode = () => {
      const data = findTypedNode(doc.root, ids.shapeId, ShapeNode)?.get()?.data;
      if (data === undefined) throw new Error("expected a shape node");
      return data;
    };
    const beforeViewBox = JSON.stringify(shapeNode().viewBox);

    const previous = doc.transaction((root) =>
      updateShapeNodeData(root, ids.shapeId, {
        svgSource: "<svg/>",
        viewBox: { height: 48, minX: 0, minY: 0, width: 48 },
      }),
    );
    expect(previous && Object.keys(previous).sort()).toEqual(["svgSource", "viewBox"]);
    expect(shapeNode().viewBox.width).toBe(48);

    doc.transaction((root) => {
      restoreShapeNodeData(root, ids.shapeId, previous ?? {});
    });
    expect(shapeNode().svgSource).toBeUndefined();
    expect(JSON.stringify(shapeNode().viewBox)).toBe(beforeViewBox);
  });
});
