import { describe, expect, it, vi } from "vitest";

import {
  createPanelSession,
  Panel,
  type PanelContext,
  type PanelIntent,
  type PanelProps,
  type PanelPropHandle,
  type PanelRefPropHandle,
  type PanelSessionInputs,
} from "../src/panel/index";
import { PANEL_CAPS } from "../src/schema/panel-tree";

/**
 * Builds a session that captures the ctx handed to the definition + intents.
 * `P` names the concrete `ctx.props` shape so tests read handles without union
 * narrowing gymnastics.
 */
const makeIntentSession = <P extends PanelProps>(
  inputs: PanelSessionInputs,
): { intents: PanelIntent[]; ctx: PanelContext<P>; dispose: () => void } => {
  const intents: PanelIntent[] = [];
  let captured!: PanelContext<P>;
  const session = createPanelSession<P>({
    render: (ctx) => {
      captured = ctx;
      return <Panel />;
    },
    initialInputs: inputs,
    callbacks: { onTree: () => {}, onError: () => {} },
    intentSink: (batch) => intents.push(...batch),
  });
  return { intents, ctx: captured, dispose: () => session.dispose() };
};

describe("panel intents — set/reset/cancel", () => {
  it("emits a live set-prop then a commit set-prop", () => {
    const { intents, ctx, dispose } = makeIntentSession<{ accentColor: PanelPropHandle<string> }>({
      props: { accentColor: { kind: "string", value: "#000" } },
      selection: { count: 1 },
      data: { products: [], variables: {} },
    });
    ctx.props.accentColor.set("#111", { gesture: "live" });
    ctx.props.accentColor.set("#222", { gesture: "commit" });
    expect(intents).toEqual([
      { type: "set-prop", name: "accentColor", value: "#111", gesture: "live" },
      { type: "set-prop", name: "accentColor", value: "#222", gesture: "commit" },
    ]);
    dispose();
  });

  it("defaults the gesture to commit", () => {
    const { intents, ctx, dispose } = makeIntentSession<{ title: PanelPropHandle<string> }>({
      props: { title: { kind: "string", value: "x" } },
      selection: { count: 1 },
      data: { products: [], variables: {} },
    });
    ctx.props.title.set("y");
    expect(intents[0]).toEqual({
      type: "set-prop",
      name: "title",
      value: "y",
      gesture: "commit",
    });
    dispose();
  });

  it("emits reset-prop and gesture-discard", () => {
    const { intents, ctx, dispose } = makeIntentSession<{ size: PanelPropHandle<number> }>({
      props: { size: { kind: "number", value: 12 } },
      selection: { count: 1 },
      data: { products: [], variables: {} },
    });
    ctx.props.size.reset();
    ctx.props.size.cancel();
    expect(intents).toEqual([
      { type: "reset-prop", name: "size" },
      { type: "gesture-discard", name: "size" },
    ]);
    dispose();
  });

  it("drops a set() on a bound prop (host owns binding)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { intents, ctx, dispose } = makeIntentSession<{ accentColor: PanelPropHandle<string> }>({
      props: { accentColor: { kind: "string", value: "#abc", bound: true } },
      selection: { count: 1 },
      data: { products: [], variables: {} },
    });
    expect(ctx.props.accentColor.bound).toBe(true);
    ctx.props.accentColor.set("#def");
    expect(intents).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    dispose();
  });

  it("drops an oversized set-prop value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { intents, ctx, dispose } = makeIntentSession<{ blob: PanelPropHandle<string> }>({
      props: { blob: { kind: "string", value: "" } },
      selection: { count: 1 },
      data: { products: [], variables: {} },
    });
    ctx.props.blob.set("x".repeat(PANEL_CAPS.intentBytes + 1));
    expect(intents).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    dispose();
  });

  it("resolves a ref handle to the product and emits set-ref", () => {
    const product = { id: "p1", slug: "p1", displayName: "Pro", priceString: "$9" };
    const { intents, ctx, dispose } = makeIntentSession<{ product: PanelRefPropHandle }>({
      props: { product: { kind: "ref", productId: "p1" } },
      selection: { count: 1 },
      data: { products: [product], variables: {} },
    });
    expect(ctx.props.product.value).toEqual(product);
    expect(ctx.props.product.productId).toBe("p1");
    ctx.props.product.set("p2");
    expect(intents).toEqual([{ type: "set-ref", name: "product", productId: "p2" }]);
    dispose();
  });

  it("exposes a read-only component handle with no writer", () => {
    const { ctx, dispose } = makeIntentSession({
      props: { slot: { kind: "component", value: null } },
      selection: { count: 1 },
      data: { products: [], variables: {} },
    });
    const handle = ctx.props.slot!;
    expect(handle.kind).toBe("component");
    expect("set" in handle).toBe(false);
    dispose();
  });
});
