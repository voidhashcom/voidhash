import type { ComponentPropDefinition } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { ComponentNode } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";
import { Effect } from "effect";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../testing/offline-document";
import {
  prefillBuiltinDefaultProps,
  prefillComponentDefaultProps,
  readComponentPropEntries,
  removeComponentActionEntry,
  removeComponentPropEntries,
  removeComponentPropEntry,
  restoreComponentActionBindings,
  restoreComponentNodeScalars,
  restoreComponentPropBindings,
  updateComponentNodeData,
  writeComponentActionBinding,
  writeComponentPropBinding,
} from "./component-node-writes";
import { findTypedNode } from "./node-proxies";

function makeDocumentWithComponent() {
  const doc = createOfflineDesignerDocument();
  const { screenId } = seededIds(doc);
  let componentId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) return Effect.runSync(Effect.die(new Error("expected the seeded screen node")));
    componentId = screen.children.insertLast({
      type: "component",
      componentSlug: "product-option",
      componentVersion: 2,
      contentHash: "ab93f1",
    }).id;
  });
  return { componentId, doc };
}

function rawComponentData(doc: OfflineDesignerDocument, nodeId: string) {
  const data = findTypedNode(doc.root, nodeId, ComponentNode)?.get()?.data;
  if (data === undefined) {
    return Effect.runSync(Effect.die(new Error("expected a component node")));
  }
  return data;
}

function rawPropEntries(doc: OfflineDesignerDocument, nodeId: string) {
  return rawComponentData(doc, nodeId).props;
}

function rawActionEntries(doc: OfflineDesignerDocument, nodeId: string) {
  return rawComponentData(doc, nodeId).actionBindings;
}

const literalString = (value: string) =>
  ({ type: "literal", value: { key: "string", value } }) as const;

describe("prefillComponentDefaultProps", () => {
  test("writes storable manifest defaults with unique ids and positions", () => {
    const { componentId, doc } = makeDocumentWithComponent();
    const manifestProps: Record<string, ComponentPropDefinition> = {
      accentColor: { default: "#16a34a", kind: "string" },
      count: { default: 3, kind: "number" },
      enabled: { kind: "boolean" },
      tags: { default: ["a", "b"], item: { kind: "string" }, kind: "array" },
    };

    doc.transaction((root) => {
      prefillComponentDefaultProps(root, componentId, manifestProps);
    });

    const entries = rawPropEntries(doc, componentId);
    const names = entries
      .map((entry) => entry.value?.name)
      .sort((a, b) => (a ?? "").localeCompare(b ?? ""));
    expect(names).toEqual([
      "accentColor",
      "count",
      "tags",
    ]);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(3);
    expect(new Set(entries.map((entry) => entry.pos)).size).toBe(3);

    const accent = entries.find((entry) => entry.value?.name === "accentColor");
    expect(accent?.value?.value).toEqual(literalString("#16a34a"));
    const tags = entries.find((entry) => entry.value?.name === "tags");
    // inner scalar arrays snapshot as {id, pos, value} entries
    expect(tags?.value?.value.type).toBe("literal");
    const tagsValue = tags?.value?.value;
    if (tagsValue?.type !== "literal" || tagsValue.value.key !== "string-array") {
      return Effect.runSync(Effect.die(new Error("expected a string-array literal")));
    }
    expect(tagsValue.value.value.map((entry) => entry.value)).toEqual(["a", "b"]);
  });
});

describe("prefillBuiltinDefaultProps", () => {
  test("drops the definition's pre-built bindings straight into props", () => {
    const { componentId, doc } = makeDocumentWithComponent();

    doc.transaction((root) => {
      prefillBuiltinDefaultProps(root, componentId, [
        { name: "label", value: literalString("New") },
        { name: "tone", value: literalString("accent") },
      ]);
    });

    const entries = rawPropEntries(doc, componentId);
    const names = entries
      .map((entry) => entry.value?.name)
      .sort((a, b) => (a ?? "").localeCompare(b ?? ""));
    expect(names).toEqual(["label", "tone"]);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(2);
    expect(new Set(entries.map((entry) => entry.pos)).size).toBe(2);
    const label = entries.find((entry) => entry.value?.name === "label");
    expect(label?.value?.value).toEqual(literalString("New"));
  });
});

describe("writeComponentPropBinding", () => {
  test("adds a new entry, then updates it in place without duplicating", () => {
    const { componentId, doc } = makeDocumentWithComponent();

    const added = doc.transaction((root) =>
      writeComponentPropBinding(root, componentId, "accentColor", literalString("#111111")),
    );
    expect(added).toEqual({ existed: false, previousRaw: undefined });
    expect(rawPropEntries(doc, componentId)).toHaveLength(1);
    const entryId = rawPropEntries(doc, componentId)[0]?.id;

    const updated = doc.transaction((root) =>
      writeComponentPropBinding(root, componentId, "accentColor", literalString("#222222")),
    );
    expect(updated?.existed).toBe(true);
    expect(updated?.previousRaw).toEqual(literalString("#111111"));

    const entries = rawPropEntries(doc, componentId);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe(entryId);
    expect(entries[0]?.value?.value).toEqual(literalString("#222222"));
  });

  test("assigns unique positions when adding multiple entries", () => {
    const { componentId, doc } = makeDocumentWithComponent();

    doc.transaction((root) => {
      writeComponentPropBinding(root, componentId, "first", literalString("1"));
    });
    doc.transaction((root) => {
      writeComponentPropBinding(root, componentId, "second", literalString("2"));
      writeComponentPropBinding(root, componentId, "third", literalString("3"));
    });

    const entries = rawPropEntries(doc, componentId);
    expect(entries.map((entry) => entry.value?.name)).toEqual(["first", "second", "third"]);
    expect(new Set(entries.map((entry) => entry.pos)).size).toBe(3);
  });

  test("returns undefined for missing nodes and writes nothing", () => {
    const { doc } = makeDocumentWithComponent();
    const result = doc.transaction((root) =>
      writeComponentPropBinding(root, "missing", "accentColor", literalString("#111111")),
    );
    expect(result).toBeUndefined();
  });
});

describe("removeComponentPropEntry", () => {
  test("removes the named entry and restore re-adds the previous value", () => {
    const { componentId, doc } = makeDocumentWithComponent();
    doc.transaction((root) => {
      writeComponentPropBinding(root, componentId, "keep", literalString("k"));
      writeComponentPropBinding(root, componentId, "drop", literalString("d"));
    });

    const removed = doc.transaction((root) => removeComponentPropEntry(root, componentId, "drop"));
    expect(removed?.removed).toBe(true);
    expect(removed?.previousRaw).toEqual(literalString("d"));
    expect(rawPropEntries(doc, componentId).map((entry) => entry.value?.name)).toEqual(["keep"]);

    doc.transaction((root) => {
      restoreComponentPropBindings(root, componentId, [
        { name: "drop", raw: removed?.previousRaw },
      ]);
    });
    const entries = rawPropEntries(doc, componentId);
    expect(entries.map((entry) => entry.value?.name)).toEqual(["keep", "drop"]);
    expect(entries[1]?.value?.value).toEqual(literalString("d"));
  });

  test("reports removed: false when no entry stores the name", () => {
    const { componentId, doc } = makeDocumentWithComponent();
    const removed = doc.transaction((root) =>
      removeComponentPropEntry(root, componentId, "absent"),
    );
    expect(removed).toEqual({ previousRaw: undefined, removed: false });
  });
});

describe("removeComponentPropEntries", () => {
  test("drops version-update props and restore replays captured values", () => {
    const { componentId, doc } = makeDocumentWithComponent();
    doc.transaction((root) => {
      writeComponentPropBinding(root, componentId, "kept", literalString("k"));
      writeComponentPropBinding(root, componentId, "droppedA", literalString("a"));
      writeComponentPropBinding(root, componentId, "droppedB", literalString("b"));
    });

    const removed = doc.transaction((root) =>
      removeComponentPropEntries(root, componentId, ["droppedA", "droppedB"]),
    );
    expect(removed).toEqual([
      { name: "droppedA", raw: literalString("a") },
      { name: "droppedB", raw: literalString("b") },
    ]);
    expect(rawPropEntries(doc, componentId).map((entry) => entry.value?.name)).toEqual(["kept"]);

    doc.transaction((root) => {
      restoreComponentPropBindings(root, componentId, removed);
    });
    const entries = rawPropEntries(doc, componentId);
    const names = entries
      .map((entry) => entry.value?.name)
      .sort((a, b) => (a ?? "").localeCompare(b ?? ""));
    expect(names).toEqual([
      "droppedA",
      "droppedB",
      "kept",
    ]);
    expect(
      entries.find((entry) => entry.value?.name === "droppedA")?.value?.value,
    ).toEqual(literalString("a"));
  });
});

describe("forward-compat drop semantics", () => {
  test("restores with unknown union variants are dropped without throwing", () => {
    const { componentId, doc } = makeDocumentWithComponent();
    const exoticRaw = { payload: { weird: true }, type: "future-kind" };

    doc.transaction((root) => {
      writeComponentPropBinding(root, componentId, "known", literalString("k"));
      restoreComponentPropBindings(root, componentId, [{ name: "exotic", raw: exoticRaw }]);
      restoreComponentActionBindings(root, componentId, [{ name: "onExotic", raw: exoticRaw }]);
    });

    expect(rawPropEntries(doc, componentId).map((entry) => entry.value?.name)).toEqual(["known"]);
    expect(rawActionEntries(doc, componentId)).toHaveLength(0);
  });

  test("malformed raw payloads are dropped without throwing", () => {
    const { componentId, doc } = makeDocumentWithComponent();

    doc.transaction((root) => {
      restoreComponentPropBindings(root, componentId, [
        { name: "broken", raw: { type: "literal", value: { key: "number", value: "NaN" } } },
        { name: "null", raw: null },
      ]);
    });

    expect(rawPropEntries(doc, componentId)).toHaveLength(0);
  });
});

describe("readComponentPropEntries", () => {
  test("reads entries in position order with entry ids", () => {
    const { componentId, doc } = makeDocumentWithComponent();
    doc.transaction((root) => {
      writeComponentPropBinding(root, componentId, "a", literalString("1"));
      writeComponentPropBinding(root, componentId, "b", literalString("2"));
    });

    const entries = doc.transaction((root) => readComponentPropEntries(root, componentId));
    expect(entries.map((entry) => entry.name)).toEqual(["a", "b"]);
    expect(entries[0]?.entryId).toBe(rawPropEntries(doc, componentId)[0]?.id);
    expect(entries[0]?.raw).toEqual(literalString("1"));
  });
});

describe("writeComponentActionBinding", () => {
  test("adds, updates in place, removes, and restores action bindings", () => {
    const { componentId, doc } = makeDocumentWithComponent();

    const added = doc.transaction((root) =>
      writeComponentActionBinding(root, componentId, "onSelect", { type: "close-paywall" }),
    );
    expect(added).toEqual({ existed: false, previousRaw: undefined });

    const updated = doc.transaction((root) =>
      writeComponentActionBinding(root, componentId, "onSelect", { type: "none" }),
    );
    expect(updated?.existed).toBe(true);
    expect(updated?.previousRaw).toEqual({ type: "close-paywall" });

    let entries = rawActionEntries(doc, componentId);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.value?.action).toEqual({ type: "none" });

    const removed = doc.transaction((root) =>
      removeComponentActionEntry(root, componentId, "onSelect"),
    );
    expect(removed?.removed).toBe(true);
    expect(rawActionEntries(doc, componentId)).toHaveLength(0);

    doc.transaction((root) => {
      restoreComponentActionBindings(root, componentId, [
        { name: "onSelect", raw: removed?.previousRaw },
      ]);
    });
    entries = rawActionEntries(doc, componentId);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.value?.action).toEqual({ type: "none" });
  });
});

describe("updateComponentNodeData", () => {
  test("captures only the scalars the update touches and never the arrays", () => {
    const { componentId, doc } = makeDocumentWithComponent();
    doc.transaction((root) => {
      writeComponentPropBinding(root, componentId, "accentColor", literalString("#111111"));
    });

    const previous = doc.transaction((root) =>
      updateComponentNodeData(root, componentId, { name: "Renamed" }),
    );
    expect(previous).toEqual({ name: "Component" });
    expect(rawComponentData(doc, componentId).name).toBe("Renamed");
  });

  test("scalar restore round trip leaves prop entries unwrapped", () => {
    const { componentId, doc } = makeDocumentWithComponent();
    doc.transaction((root) => {
      writeComponentPropBinding(root, componentId, "accentColor", literalString("#111111"));
    });
    const entriesBefore = rawPropEntries(doc, componentId);

    const previous = doc.transaction((root) =>
      updateComponentNodeData(root, componentId, { name: "Renamed" }),
    );
    doc.transaction((root) => {
      restoreComponentNodeScalars(root, componentId, previous ?? {});
    });

    expect(rawComponentData(doc, componentId).name).toBe("Component");
    const entriesAfter = rawPropEntries(doc, componentId);
    expect(entriesAfter).toEqual(entriesBefore);
    expect(entriesAfter[0]?.value?.value).toEqual(literalString("#111111"));
  });

  test("captures version-update scalars including previewState resets", () => {
    const { componentId, doc } = makeDocumentWithComponent();

    const previous = doc.transaction((root) =>
      updateComponentNodeData(root, componentId, {
        componentVersion: 3,
        contentHash: "deadbeef",
        previewState: "default",
      }),
    );
    expect(previous).toEqual({
      componentVersion: 2,
      contentHash: "ab93f1",
      previewState: "default",
    });

    const data = rawComponentData(doc, componentId);
    expect(data.componentVersion).toBe(3);
    expect(data.contentHash).toBe("deadbeef");

    doc.transaction((root) => {
      restoreComponentNodeScalars(root, componentId, previous ?? {});
    });
    const restored = rawComponentData(doc, componentId);
    expect(restored.componentVersion).toBe(2);
    expect(restored.contentHash).toBe("ab93f1");
  });
});
