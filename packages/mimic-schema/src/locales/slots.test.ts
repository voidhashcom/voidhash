import { validate } from "@voidhash/mimic-core";
import { describe, expect, test } from "vite-plus/test";

import {
  PaywallDesignerDocument,
  type PaywallDesignerDocumentInput,
} from "../document.ts";
import type { RootNodeData } from "../nodes/root-node.ts";
import type { ScreenNodeData } from "../nodes/screen-node.ts";
import { collectLocalizableSlots } from "./slots.ts";

function decodeRoot(input: PaywallDesignerDocumentInput): RootNodeData {
  const value = PaywallDesignerDocument.encode(input);
  return PaywallDesignerDocument.decode(validate(PaywallDesignerDocument.schema, value))![0]!;
}

const root = decodeRoot([
  {
    type: "root",
    name: "Paywall",
    children: [
      {
        type: "screen",
        name: "Screen A",
        children: [
          { type: "text", name: "T1", text: "Hi" },
          {
            type: "view",
            name: "ImgView",
            style: { backgroundImage: { url: "https://img.png", resizeMode: "cover" } },
          },
          { type: "view", name: "EmptyView" },
          {
            type: "component",
            componentSlug: "cta",
            componentVersion: 1,
            contentHash: "hash",
            props: [
              { name: "title", value: { type: "literal", value: { key: "string", value: "Buy" } } },
              { name: "count", value: { type: "variable-reference", value: { id: "var-1" } } },
            ],
          },
        ],
      },
      {
        type: "screen",
        name: "Screen B",
        style: { backgroundImage: { url: "https://screen.png", resizeMode: "cover" } },
      },
    ],
  },
]);

const screenA = root.children[0]! as ScreenNodeData;
const screenB = root.children[1]! as ScreenNodeData;
const textNode = screenA.children[0]!;
const imgView = screenA.children[1]!;
const component = screenA.children[3]!;

describe("collectLocalizableSlots", () => {
  const slots = collectLocalizableSlots(root, {
    getLocalizableProps: () => [
      { propName: "title", label: "Title" },
      { propName: "count", label: "Count" },
    ],
  });

  test("collects text, image, and literal component-prop slots in tree order", () => {
    expect(slots.map((slot) => slot.kind)).toEqual(["text", "image", "componentProp", "image"]);
  });

  test("groups slots by containing screen (screen's own id for its own image)", () => {
    expect(slots[0]).toMatchObject({
      kind: "text",
      nodeId: textNode.id,
      label: "T1",
      baseValue: "Hi",
      screenId: screenA.id,
    });
    expect(slots[1]).toMatchObject({
      kind: "image",
      nodeId: imgView.id,
      label: "ImgView",
      screenId: screenA.id,
    });
    expect(slots[1]!.kind === "image" && slots[1]!.baseValue.url).toBe("https://img.png");
    expect(slots[2]).toMatchObject({
      kind: "componentProp",
      nodeId: component.id,
      propName: "title",
      label: "Title",
      screenId: screenA.id,
    });
    expect(slots[3]).toMatchObject({
      kind: "image",
      nodeId: screenB.id,
      screenId: screenB.id,
    });
  });

  test("excludes empty-image views and variable-bound props", () => {
    // EmptyView (no bg url) and the variable-reference-bound `count` prop absent.
    expect(slots.some((slot) => slot.kind === "image" && slot.label === "EmptyView")).toBe(false);
    expect(slots.some((slot) => slot.kind === "componentProp" && slot.propName === "count")).toBe(
      false,
    );
  });

  test("emits no component-prop slots without getLocalizableProps", () => {
    const bare = collectLocalizableSlots(root);
    expect(bare.some((slot) => slot.kind === "componentProp")).toBe(false);
    // Still collects text + two images.
    expect(bare.map((slot) => slot.kind)).toEqual(["text", "image", "image"]);
  });

  test("collects a scrollView's non-empty background image, like a view", () => {
    const scrollRoot = decodeRoot([
      {
        type: "root",
        name: "Paywall",
        children: [
          {
            type: "screen",
            name: "Screen A",
            children: [
              {
                type: "scrollView",
                name: "ImgScroll",
                style: { backgroundImage: { url: "https://scroll.png", resizeMode: "cover" } },
              },
              { type: "scrollView", name: "EmptyScroll" },
            ],
          },
        ],
      },
    ]);
    const screen = scrollRoot.children[0]! as ScreenNodeData;
    const imgScroll = screen.children[0]!;
    const slots = collectLocalizableSlots(scrollRoot);
    expect(slots.map((slot) => slot.kind)).toEqual(["image"]);
    expect(slots[0]).toMatchObject({
      kind: "image",
      nodeId: imgScroll.id,
      label: "ImgScroll",
      screenId: screen.id,
    });
    expect(slots[0]!.kind === "image" && slots[0]!.baseValue.url).toBe("https://scroll.png");
  });
});
