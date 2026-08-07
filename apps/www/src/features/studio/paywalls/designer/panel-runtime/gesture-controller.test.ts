import { Effect } from "effect";
import { describe, expect, test, vi } from "vite-plus/test";

import { createPanelGestureController, type DraftPairing } from "./gesture-controller";

const makePairing = () => {
  const calls: string[] = [];
  const pairing: DraftPairing = {
    begin: () => calls.push("begin"),
    commit: () => calls.push("commit"),
    discard: () => calls.push("discard"),
  };
  return { pairing, calls };
};

describe("gesture-controller — active gesture + echo freeze", () => {
  test("beginGesture freezes the node's value props; endGesture drops the freeze", () => {
    const controller = createPanelGestureController();
    const node = { id: 7, props: { value: "50", disabled: false } };

    // No gesture: props pass through unchanged.
    expect(controller.filterNodeProps(node)).toEqual({ value: "50", disabled: false });
    expect(controller.isGestureActive(7)).toBe(false);

    // Begin a gesture on node 7 with the frozen props.
    controller.beginGesture(7, { value: "50", disabled: false });
    expect(controller.isGestureActive(7)).toBe(true);
    expect(controller.activeGestureNode()).toBe(7);

    // A later tree emits value "80"; the frozen "50" is used for node 7.
    const echoed = controller.filterNodeProps({ id: 7, props: { value: "80", disabled: false } });
    expect(echoed.value).toBe("50");

    // A different node is unaffected mid-gesture.
    const other = controller.filterNodeProps({ id: 9, props: { value: "abc" } });
    expect(other.value).toBe("abc");

    // End the gesture: authoritative value re-applies.
    controller.endGesture();
    expect(controller.isGestureActive(7)).toBe(false);
    const afterEnd = controller.filterNodeProps({ id: 7, props: { value: "80" } });
    expect(afterEnd.value).toBe("80");
  });

  test("handlers are always taken from the live node, even mid-gesture", () => {
    const controller = createPanelGestureController();
    const staleHandler = () => "stale";
    const liveHandler = () => "live";
    controller.beginGesture(1, { value: "1", onChange: staleHandler });
    const filtered = controller.filterNodeProps({
      id: 1,
      props: { value: "2", onChange: liveHandler },
    });
    // Value frozen, handler live.
    expect(filtered.value).toBe("1");
    expect(filtered.onChange).toBe(liveHandler);
  });
});

describe("gesture-controller — draft pairing state machine", () => {
  test("first live intent begins the draft exactly once; commit commits", () => {
    const { pairing, calls } = makePairing();
    const controller = createPanelGestureController();
    controller.attachDraftPairing(pairing);

    expect(controller.isDraftOpen()).toBe(false);
    controller.onLiveIntent();
    controller.onLiveIntent();
    controller.onLiveIntent();
    expect(controller.isDraftOpen()).toBe(true);
    expect(calls).toEqual(["begin"]); // begin ONCE across three live intents

    controller.onGestureCommit();
    expect(controller.isDraftOpen()).toBe(false);
    expect(calls).toEqual(["begin", "commit"]);
  });

  test("gesture-discard discards the open draft", () => {
    const { pairing, calls } = makePairing();
    const controller = createPanelGestureController();
    controller.attachDraftPairing(pairing);
    controller.onLiveIntent();
    controller.onGestureDiscard();
    expect(controller.isDraftOpen()).toBe(false);
    expect(calls).toEqual(["begin", "discard"]);
  });

  test("selection change discards the open draft", () => {
    const { pairing, calls } = makePairing();
    const controller = createPanelGestureController();
    controller.attachDraftPairing(pairing);
    controller.onLiveIntent();
    controller.notifySelectionChange();
    expect(calls).toEqual(["begin", "discard"]);
    expect(controller.lastDiscardReason()).toBe("selection-change");
  });

  test("session death discards the open draft and clears gesture state", () => {
    const { pairing, calls } = makePairing();
    const controller = createPanelGestureController();
    controller.attachDraftPairing(pairing);
    controller.beginGesture(3, { value: "x" });
    controller.onLiveIntent();
    controller.notifySessionDeath();
    expect(calls).toEqual(["begin", "discard"]);
    expect(controller.isGestureActive(3)).toBe(false);
    expect(controller.activeGestureNode()).toBe(null);
  });

  test("10s inactivity discards the open draft (fake timers)", () => {
    vi.useFakeTimers();
    Effect.runSync(
      Effect.sync(() => {
        const { pairing, calls } = makePairing();
        const controller = createPanelGestureController({ inactivityMs: 10_000 });
        controller.attachDraftPairing(pairing);

        controller.onLiveIntent();
        expect(controller.isDraftOpen()).toBe(true);

        // 9s: not yet discarded.
        vi.advanceTimersByTime(9_000);
        expect(controller.isDraftOpen()).toBe(true);
        expect(calls).toEqual(["begin"]);

        // Another live intent resets the idle timer.
        controller.onLiveIntent();
        vi.advanceTimersByTime(9_000);
        expect(controller.isDraftOpen()).toBe(true);

        // Cross the 10s idle window with no further intents → discard.
        vi.advanceTimersByTime(1_500);
        expect(controller.isDraftOpen()).toBe(false);
        expect(calls).toEqual(["begin", "discard"]);
        expect(controller.lastDiscardReason()).toBe("inactivity");
      }).pipe(Effect.ensuring(Effect.sync(() => vi.useRealTimers()))),
    );
  });

  test("commit clears the idle timer (no late inactivity discard)", () => {
    vi.useFakeTimers();
    Effect.runSync(
      Effect.sync(() => {
        const { pairing, calls } = makePairing();
        const controller = createPanelGestureController({ inactivityMs: 10_000 });
        controller.attachDraftPairing(pairing);
        controller.onLiveIntent();
        controller.onGestureCommit();
        // Even after the idle window elapses, no extra discard fires.
        vi.advanceTimersByTime(30_000);
        expect(calls).toEqual(["begin", "commit"]);
      }).pipe(Effect.ensuring(Effect.sync(() => vi.useRealTimers()))),
    );
  });

  test("live/commit are no-ops when no pairing is attached", () => {
    const controller = createPanelGestureController();
    controller.onLiveIntent();
    controller.onGestureCommit();
    controller.onGestureDiscard();
    expect(controller.isDraftOpen()).toBe(false);
  });
});
