"use client";

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { useCallback, useEffect, useRef, useState } from "react";

import { updateFillStyle } from "../../state/actions";
import { isStatefulNodeType } from "../../state/actions/node-resolver";
import type { StyleTarget } from "../../state/actions/features/style-action-helpers";
import type { BackgroundGradient } from "../../state/actions/features/fill-style-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../state/designer-store";
import type { DesignerStoreState } from "../../state/designer-store-state";
import type { BoundingBox } from "../../state/utils/bounding-box";
import {
  getSelectedStateIdForNode,
  isStateCapableNode,
  resolveEffectiveStyle,
} from "../../state/utils/state-overrides";
import { selectedNodeIdsFromPresence } from "../../state/utils/presence";
import { findNodeById } from "../../state/utils/tree";
import { selectRenderRoot } from "../../state/utils/document-root";

const HANDLE_HIT_SIZE = 18;

/** The decoded gradient read shape: scalar fields plain, array elements wrapped. */
interface DecodedGradient {
  kind: "linear" | "radial";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  stops: Array<{ value?: { color: string; position: number } }>;
}

interface GradientOverlayState {
  target: StyleTarget;
  box: BoundingBox;
  gradient: BackgroundGradient;
  scale: number;
  panX: number;
  panY: number;
}

/** Unwrap the CRDT-decoded gradient into the logical write shape. */
function toWriteGradient(decoded: DecodedGradient): BackgroundGradient {
  const stops = decoded.stops
    .map((entry) => entry.value)
    .filter((stop): stop is { color: string; position: number } => stop !== undefined)
    .map((stop) => ({ color: stop.color, position: stop.position }));
  return {
    kind: decoded.kind,
    startX: decoded.startX,
    startY: decoded.startY,
    endX: decoded.endX,
    endY: decoded.endY,
    stops,
  };
}

/**
 * Reads the single-selected node's gradient overlay geometry from the store, or
 * `null` when the overlay should not render (multi/no selection, non-gradient
 * fill, disabled background, missing bounding box).
 */
function readOverlayState(state: DesignerStoreState): GradientOverlayState | null {
  const selectedNodeIds = selectedNodeIdsFromPresence(state.mimic.presence?.self);
  if (selectedNodeIds.length !== 1) return null;
  const nodeId = selectedNodeIds[0]!;

  const box = state.canvas.boundingBoxes[nodeId];
  if (!box) return null;

  // Draft-aware so the handle markers track the cursor live during a drag; the
  // dispatched endpoint writes land in the active draft, not `mimic.snapshot`.
  const root = selectRenderRoot(state);
  const node = findNodeById<SnapshotNode>(root, nodeId);
  if (!node || !isStateCapableNode(node) || !isStatefulNodeType(node.type)) return null;

  const stateId = getSelectedStateIdForNode(state.stateOverrideSelection, nodeId);
  const effective = resolveEffectiveStyle(node, stateId);
  if (effective.backgroundEnabled !== true || effective.backgroundType !== "gradient") return null;

  const decoded = effective.backgroundGradient as DecodedGradient | undefined;
  if (!decoded) return null;

  return {
    target: { nodeId, nodeType: node.type },
    box,
    gradient: toWriteGradient(decoded),
    scale: state.canvas.scale,
    panX: state.canvas.x,
    panY: state.canvas.y,
  };
}

/**
 * Renders draggable start/end handles for the selected node's linear/radial
 * gradient. Screen-space DOM/SVG layer that mirrors `SelectionOverlay`'s
 * drag/wheel/Escape lifecycle. Writes flow through `updateFillStyle` into the
 * active draft so the canvas preview updates live.
 */
export function GradientOverlay({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { begin: beginDraft, commit: commitDraft, discard: discardDraft } = useDesignerDraft(store);

  const [overlay, setOverlay] = useState<GradientOverlayState | null>(null);

  useEffect(() => {
    const update = () => setOverlay(readOverlayState(store.getState() as DesignerStoreState));
    update();
    const unsubscribe = store.subscribe(update);
    return () => unsubscribe();
  }, [store]);

  const startHandleRef = useRef<HTMLDivElement>(null);
  const endHandleRef = useRef<HTMLDivElement>(null);

  // Removes the document listeners for the in-flight drag, if any. Held in a ref
  // so an unmount mid-drag can tear the listeners down (see the effect below).
  // This only detaches listeners; the draft itself is discarded by
  // `useDesignerDraft`'s own unmount teardown, so we must not double-discard.
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    },
    [],
  );

  // Non-passive wheel re-dispatch so zoom keeps working while hovering handles.
  useEffect(() => {
    const container = containerRef.current;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (container) {
        container.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
            ctrlKey: e.ctrlKey,
            deltaMode: e.deltaMode,
            deltaX: e.deltaX,
            deltaY: e.deltaY,
            deltaZ: e.deltaZ,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
          }),
        );
      }
    };
    const els = [startHandleRef.current, endHandleRef.current].filter(
      (el): el is HTMLDivElement => el !== null,
    );
    for (const el of els) {
      el.addEventListener("wheel", handleWheel, { passive: false });
    }
    return () => {
      for (const el of els) {
        el.removeEventListener("wheel", handleWheel);
      }
    };
  }, [containerRef, overlay !== null]);

  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent, endpoint: "start" | "end") => {
      e.preventDefault();
      e.stopPropagation();

      const initial = readOverlayState(store.getState() as DesignerStoreState);
      if (!initial) return;
      const { target, box } = initial;
      const other =
        endpoint === "start"
          ? { x: initial.gradient.endX, y: initial.gradient.endY }
          : { x: initial.gradient.startX, y: initial.gradient.startY };

      beginDraft();

      const cleanup = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.removeEventListener("keydown", onKeyDown);
        dragCleanupRef.current = null;
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        const s = store.getState() as DesignerStoreState;
        const { scale, x: panX, y: panY } = s.canvas;
        const current = readOverlayState(s);
        // Prefer the fresh box (mousedown snapshot may be stale after a resize);
        // fall back to the snapshot when the node no longer resolves mid-drag.
        const activeBox = current?.box ?? box;
        // Screen → normalized node space. The overlay layer is absolute inset-0
        // over the same container the pan/scale are expressed in, so the
        // container offset cancels (mirrors selection-overlay's math). A zero
        // (or non-finite) box dimension would yield Infinity/NaN, so skip the
        // move entirely rather than write a non-finite coord into the document.
        if (
          !Number.isFinite(activeBox.width) ||
          !Number.isFinite(activeBox.height) ||
          activeBox.width === 0 ||
          activeBox.height === 0
        ) {
          return;
        }
        let gx = ((moveEvent.clientX - panX) / scale - activeBox.x) / activeBox.width;
        let gy = ((moveEvent.clientY - panY) / scale - activeBox.y) / activeBox.height;

        // Shift constrains the line to 0/45/90° relative to the fixed endpoint.
        if (moveEvent.shiftKey) {
          const dx = gx - other.x;
          const dy = gy - other.y;
          const angle = Math.atan2(dy, dx);
          const snapped = (Math.round(angle / (Math.PI / 4)) * Math.PI) / 4;
          const len = Math.hypot(dx, dy);
          gx = other.x + Math.cos(snapped) * len;
          gy = other.y + Math.sin(snapped) * len;
        }

        // Final guard: division could still produce non-finite values if scale
        // is 0 or an input was non-finite. Never dispatch a non-finite coord.
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) return;

        const gradient = current?.gradient ?? initial.gradient;
        const next: BackgroundGradient =
          endpoint === "start"
            ? { ...gradient, startX: gx, startY: gy }
            : { ...gradient, endX: gx, endY: gy };
        dispatch(updateFillStyle)({ nodes: [target], style: { backgroundGradient: next } });
      };

      const onMouseUp = () => {
        // Commit the draft BEFORE any terminal action so the write lands on the
        // undo stack draft-free (mirrors selection-overlay ordering).
        commitDraft();
        cleanup();
      };

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") {
          discardDraft();
          cleanup();
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.addEventListener("keydown", onKeyDown);
      dragCleanupRef.current = cleanup;
    },
    [store, dispatch, beginDraft, commitDraft, discardDraft],
  );

  if (!overlay) return null;

  const { box, gradient, scale, panX, panY } = overlay;
  const sx = (box.x + gradient.startX * box.width) * scale + panX;
  const sy = (box.y + gradient.startY * box.height) * scale + panY;
  const ex = (box.x + gradient.endX * box.width) * scale + panX;
  const ey = (box.y + gradient.endY * box.height) * scale + panY;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 12 }}>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <title>Gradient controls</title>
        <line
          x1={sx}
          y1={sy}
          x2={ex}
          y2={ey}
          stroke="#ffffff"
          strokeWidth={1.5}
          strokeOpacity={0.9}
        />
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#005eff" strokeWidth={0.75} />
        {/* Start handle: filled. End handle: outlined. */}
        <circle cx={sx} cy={sy} r={5} fill="#ffffff" stroke="#005eff" strokeWidth={1.5} />
        <circle cx={ex} cy={ey} r={5} fill="#005eff" stroke="#ffffff" strokeWidth={1.5} />
      </svg>
      <div
        ref={startHandleRef}
        onMouseDown={(e) => onHandleMouseDown(e, "start")}
        style={{
          cursor: "grab",
          height: HANDLE_HIT_SIZE,
          left: sx - HANDLE_HIT_SIZE / 2,
          pointerEvents: "auto",
          position: "absolute",
          top: sy - HANDLE_HIT_SIZE / 2,
          width: HANDLE_HIT_SIZE,
        }}
      />
      <div
        ref={endHandleRef}
        onMouseDown={(e) => onHandleMouseDown(e, "end")}
        style={{
          cursor: "grab",
          height: HANDLE_HIT_SIZE,
          left: ex - HANDLE_HIT_SIZE / 2,
          pointerEvents: "auto",
          position: "absolute",
          top: ey - HANDLE_HIT_SIZE / 2,
          width: HANDLE_HIT_SIZE,
        }}
      />
    </div>
  );
}
