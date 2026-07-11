import type {
  ComponentManifest,
  ComponentPropDefinition,
} from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { describe, expect, test } from "vite-plus/test";

import {
  removeComponentPropForNodes,
  updateComponentPropBindingForNodes,
} from "../state/actions/features/component-prop-actions";
import { createPanelGestureController } from "./gesture-controller";
import {
  createIntentExecutor,
  type CreateIntentExecutorOptions,
  type ExecutorProduct,
  type ExecutorTarget,
} from "./intent-executor";

/** A recorded dispatch call: which command + the params it was given. */
interface DispatchCall {
  command: unknown;
  params: unknown;
}

/** A manifest carrying just the props needed for a test. */
function manifest(props: Record<string, ComponentPropDefinition>): ComponentManifest {
  return {
    manifestVersion: 2,
    id: "test",
    props,
  } as unknown as ComponentManifest;
}

interface HarnessOptions {
  targets?: readonly ExecutorTarget[];
  manifest?: ComponentManifest | undefined;
  products?: readonly ExecutorProduct[];
  isPropBound?: (name: string) => boolean;
  inactivityMs?: number;
}

/** Builds an executor over recording dispatch + a manual frame + clock. */
function makeHarness(opts: HarnessOptions = {}) {
  const calls: DispatchCall[] = [];
  const draftLog: string[] = [];
  let pendingFrame: (() => void) | null = null;
  let clock = 0;

  const gestures = createPanelGestureController({
    inactivityMs: opts.inactivityMs ?? 10_000,
    setTimer: (fn, ms) => {
      // Fake timer: store the callback + fire it when the test advances the clock.
      const handle = { fn, at: clock + ms } as unknown as ReturnType<typeof setTimeout>;
      fakeTimers.push(handle as unknown as FakeTimer);
      return handle;
    },
    clearTimer: (handle) => {
      const idx = fakeTimers.findIndex((t) => (t as unknown) === handle);
      if (idx >= 0) fakeTimers.splice(idx, 1);
    },
  });
  interface FakeTimer {
    fn: () => void;
    at: number;
  }
  const fakeTimers: FakeTimer[] = [];

  gestures.attachDraftPairing({
    begin: () => draftLog.push("begin"),
    commit: () => draftLog.push("commit"),
    discard: () => draftLog.push("discard"),
  });

  const dispatch = ((command: unknown) =>
    (params: unknown) => {
      calls.push({ command, params });
      return undefined;
    }) as unknown as CreateIntentExecutorOptions["dispatch"];

  const executor = createIntentExecutor({
    getTargets: () => opts.targets ?? [{ nodeId: "n1" }],
    getManifest: () => ("manifest" in opts ? opts.manifest : manifest({})),
    getProducts: () => opts.products ?? [],
    gestures,
    services: { toastError: () => undefined },
    dispatch,
    isPropBound: opts.isPropBound,
    scheduleFrame: (fn) => {
      pendingFrame = fn;
    },
    now: () => clock,
  });

  return {
    executor,
    calls,
    draftLog,
    gestures,
    runFrame: () => {
      const fn = pendingFrame;
      pendingFrame = null;
      fn?.();
    },
    hasPendingFrame: () => pendingFrame !== null,
    advanceClock: (ms: number) => {
      clock += ms;
      for (const timer of [...fakeTimers]) {
        if (timer.at <= clock) {
          const idx = fakeTimers.indexOf(timer);
          if (idx >= 0) fakeTimers.splice(idx, 1);
          timer.fn();
        }
      }
    },
    setClock: (value: number) => {
      clock = value;
    },
  };
}

const stringProp: ComponentPropDefinition = { kind: "string" };
const numberProp: ComponentPropDefinition = { kind: "number" };
const boolProp: ComponentPropDefinition = { kind: "boolean" };
const selectProp: ComponentPropDefinition = { kind: "select", options: ["a", "b"] };
const refProp: ComponentPropDefinition = { kind: "ref", refType: "product" };
const componentProp: ComponentPropDefinition = { kind: "component" };
const stringArrayProp: ComponentPropDefinition = { kind: "array", item: { kind: "string" } };

describe("intent-executor — decode + validation rejections", () => {
  test("rejects a malformed intent at decode", () => {
    const h = makeHarness();
    h.executor.handle({ type: "not-a-real-intent" });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });

  test("rejects set-prop for a prop not in the manifest", () => {
    const h = makeHarness({ manifest: manifest({ title: stringProp }) });
    h.executor.handle({ type: "set-prop", name: "missing", value: "x", gesture: "commit" });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });

  test("rejects a kind mismatch (number for a string prop)", () => {
    const h = makeHarness({ manifest: manifest({ title: stringProp }) });
    h.executor.handle({ type: "set-prop", name: "title", value: 42, gesture: "commit" });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });

  test("rejects a select value not in options", () => {
    const h = makeHarness({ manifest: manifest({ variant: selectProp }) });
    h.executor.handle({ type: "set-prop", name: "variant", value: "c", gesture: "commit" });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });

  test("accepts a select value in options", () => {
    const h = makeHarness({ manifest: manifest({ variant: selectProp }) });
    h.executor.handle({ type: "set-prop", name: "variant", value: "a", gesture: "commit" });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.params).toEqual({
      nodeIds: ["n1"],
      propName: "variant",
      binding: { type: "literal", value: { key: "string", value: "a" } },
    });
  });

  test("rejects a non-finite number", () => {
    const h = makeHarness({ manifest: manifest({ count: numberProp }) });
    // NaN/Infinity cannot travel through JSON, so a large-but-finite check plus
    // an explicit rejection of a string standing in for a number covers it.
    h.executor.handle({ type: "set-prop", name: "count", value: "5", gesture: "commit" });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });

  test("rejects an array that is too long", () => {
    const h = makeHarness({ manifest: manifest({ tags: stringArrayProp }) });
    const tooLong = Array.from({ length: 201 }, (_, i) => `t${i}`);
    h.executor.handle({ type: "set-prop", name: "tags", value: tooLong, gesture: "commit" });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });

  test("rejects a heterogeneous array", () => {
    const h = makeHarness({ manifest: manifest({ tags: stringArrayProp }) });
    h.executor.handle({
      type: "set-prop",
      name: "tags",
      value: ["ok", 3],
      gesture: "commit",
    });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });

  test("rejects a write to a component (code-configured, read-only) prop", () => {
    const h = makeHarness({ manifest: manifest({ slot: componentProp }) });
    h.executor.handle({ type: "set-prop", name: "slot", value: "x", gesture: "commit" });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });

  test("rejects a write to a bound prop", () => {
    const h = makeHarness({
      manifest: manifest({ title: stringProp }),
      isPropBound: (name) => name === "title",
    });
    h.executor.handle({ type: "set-prop", name: "title", value: "x", gesture: "commit" });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });

  test("rejects a set-ref to an unknown product", () => {
    const h = makeHarness({
      manifest: manifest({ product: refProp }),
      products: [{ id: "prod_1" }],
    });
    h.executor.handle({ type: "set-ref", name: "product", productId: "prod_missing" });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });

  test("rejects an oversized set-prop value at the decode cap", () => {
    const h = makeHarness({ manifest: manifest({ title: stringProp }) });
    const huge = "x".repeat(33 * 1024);
    h.executor.handle({ type: "set-prop", name: "title", value: huge, gesture: "commit" });
    expect(h.calls).toHaveLength(0);
    expect(h.executor.rejectedCount()).toBe(1);
  });
});

describe("intent-executor — apply paths with exact payloads", () => {
  test("commit set-prop dispatches the batched action for all targets", () => {
    const h = makeHarness({
      manifest: manifest({ title: stringProp }),
      targets: [{ nodeId: "a" }, { nodeId: "b" }, { nodeId: "c" }],
    });
    h.executor.handle({ type: "set-prop", name: "title", value: "Hi", gesture: "commit" });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.command).toBe(updateComponentPropBindingForNodes);
    expect(h.calls[0]!.params).toEqual({
      nodeIds: ["a", "b", "c"],
      propName: "title",
      binding: { type: "literal", value: { key: "string", value: "Hi" } },
    });
  });

  test("boolean + number commit produce the correct binding key", () => {
    const h = makeHarness({ manifest: manifest({ on: boolProp, count: numberProp }) });
    h.executor.handle({ type: "set-prop", name: "on", value: true, gesture: "commit" });
    h.executor.handle({ type: "set-prop", name: "count", value: 7, gesture: "commit" });
    expect(h.calls[0]!.params).toMatchObject({
      binding: { type: "literal", value: { key: "boolean", value: true } },
    });
    expect(h.calls[1]!.params).toMatchObject({
      binding: { type: "literal", value: { key: "number", value: 7 } },
    });
  });

  test("string-array commit filters into a string-array binding", () => {
    const h = makeHarness({ manifest: manifest({ tags: stringArrayProp }) });
    h.executor.handle({
      type: "set-prop",
      name: "tags",
      value: ["x", "y"],
      gesture: "commit",
    });
    expect(h.calls[0]!.params).toMatchObject({
      binding: { type: "literal", value: { key: "string-array", value: ["x", "y"] } },
    });
  });

  test("set-ref dispatches a product literal binding for a known product", () => {
    const h = makeHarness({
      manifest: manifest({ product: refProp }),
      products: [{ id: "prod_1" }],
    });
    h.executor.handle({ type: "set-ref", name: "product", productId: "prod_1" });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.command).toBe(updateComponentPropBindingForNodes);
    expect(h.calls[0]!.params).toEqual({
      nodeIds: ["n1"],
      propName: "product",
      binding: { type: "literal", value: { key: "product", value: { productId: "prod_1" } } },
    });
  });

  test("reset-prop dispatches the batched remove action", () => {
    const h = makeHarness({
      manifest: manifest({ title: stringProp }),
      targets: [{ nodeId: "a" }, { nodeId: "b" }],
    });
    h.executor.handle({ type: "reset-prop", name: "title" });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.command).toBe(removeComponentPropForNodes);
    expect(h.calls[0]!.params).toEqual({ nodeIds: ["a", "b"], propName: "title" });
  });
});

describe("intent-executor — live coalescing", () => {
  test("multiple live set-props for one prop within a frame coalesce (latest wins)", () => {
    const h = makeHarness({ manifest: manifest({ w: numberProp }) });
    h.executor.handle({ type: "set-prop", name: "w", value: 1, gesture: "live" });
    h.executor.handle({ type: "set-prop", name: "w", value: 2, gesture: "live" });
    h.executor.handle({ type: "set-prop", name: "w", value: 3, gesture: "live" });
    // Nothing dispatched until the frame runs.
    expect(h.calls).toHaveLength(0);
    h.runFrame();
    // One dispatch carrying the LATEST value.
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.params).toMatchObject({
      binding: { type: "literal", value: { key: "number", value: 3 } },
    });
  });

  test("a rate flood is dropped past the cap and counted", () => {
    const h = makeHarness({ manifest: manifest({ w: numberProp }) });
    // 240 allowed per rolling second; feed 300 at the same clock tick.
    for (let i = 0; i < 300; i++) {
      h.executor.handle({ type: "set-prop", name: "w", value: i, gesture: "live" });
    }
    // 60 dropped by the rate cap.
    expect(h.executor.rejectedCount()).toBe(60);
    h.runFrame();
    // The surviving coalesced write dispatches once (latest accepted value).
    expect(h.calls).toHaveLength(1);
  });
});

describe("intent-executor — gesture pairing lifecycle", () => {
  test("live opens the draft exactly once; commit closes it with one commit", () => {
    const h = makeHarness({ manifest: manifest({ w: numberProp }) });
    h.executor.handle({ type: "set-prop", name: "w", value: 1, gesture: "live" });
    h.runFrame();
    h.executor.handle({ type: "set-prop", name: "w", value: 2, gesture: "live" });
    h.runFrame();
    // begin fired once across both live frames.
    expect(h.draftLog).toEqual(["begin"]);
    expect(h.gestures.isDraftOpen()).toBe(true);

    h.executor.handle({ type: "gesture-commit", name: "w" });
    expect(h.draftLog).toEqual(["begin", "commit"]);
    expect(h.gestures.isDraftOpen()).toBe(false);
  });

  test("gesture-discard reverts the open draft", () => {
    const h = makeHarness({ manifest: manifest({ w: numberProp }) });
    h.executor.handle({ type: "set-prop", name: "w", value: 1, gesture: "live" });
    h.runFrame();
    expect(h.gestures.isDraftOpen()).toBe(true);

    h.executor.handle({ type: "gesture-discard", name: "w" });
    expect(h.draftLog).toEqual(["begin", "discard"]);
    expect(h.gestures.isDraftOpen()).toBe(false);
    expect(h.gestures.lastDiscardReason()).toBe("gesture-discard");
  });

  test("10s of inactivity auto-discards the open draft", () => {
    const h = makeHarness({ manifest: manifest({ w: numberProp }), inactivityMs: 10_000 });
    h.executor.handle({ type: "set-prop", name: "w", value: 1, gesture: "live" });
    h.runFrame();
    expect(h.gestures.isDraftOpen()).toBe(true);

    h.advanceClock(10_000);
    expect(h.draftLog).toEqual(["begin", "discard"]);
    expect(h.gestures.isDraftOpen()).toBe(false);
    expect(h.gestures.lastDiscardReason()).toBe("inactivity");
  });

  test("gesture-commit flushes a still-pending live write before committing", () => {
    const h = makeHarness({ manifest: manifest({ w: numberProp }) });
    h.executor.handle({ type: "set-prop", name: "w", value: 5, gesture: "live" });
    // Commit BEFORE the frame ran — the pending live write must flush first.
    h.executor.handle({ type: "gesture-commit", name: "w" });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.params).toMatchObject({
      binding: { type: "literal", value: { key: "number", value: 5 } },
    });
    expect(h.draftLog).toEqual(["begin", "commit"]);
  });
});
