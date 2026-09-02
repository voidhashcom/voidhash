import { type PointerEvent, type RefObject, useRef } from "react";

import { resolveDragGestureWinner, useDragControlRegistration } from "../motion/drag";
import type {
  DragConstraints,
  DragInfo,
  DraggableMotionProps,
  MotionGestureEvent,
  MotionNodeHandle,
} from "../motion/types";
import type { DomMotionController } from "./dom-motion";

type DomElement = HTMLDivElement | HTMLImageElement;

interface DragSession {
  readonly pointerId: number;
  readonly point: { readonly x: number; readonly y: number };
  readonly origin: { readonly x: number; readonly y: number };
  readonly constraints: DragConstraints | undefined;
  lastPoint: { readonly x: number; readonly y: number };
  lastTime: number;
  lockedAxis: "x" | "y" | undefined;
  won: boolean;
}

export interface DomDragHandlers {
  readonly touchAction: "none" | "pan-x" | "pan-y" | "manipulation";
  onPointerDown(event: PointerEvent<HTMLElement>): void;
  onPointerMove(event: PointerEvent<HTMLElement>): void;
  onPointerUp(event: PointerEvent<HTMLElement>): void;
  onPointerCancel(event: PointerEvent<HTMLElement>): void;
}

const pointFromEvent = (event: PointerEvent<HTMLElement>): MotionGestureEvent => ({
  point: { x: event.clientX, y: event.clientY },
  pointerId: event.pointerId,
  timeStamp: event.timeStamp,
});

const nearestScrollAxis = (element: HTMLElement): "x" | "y" | undefined => {
  const scroll = element.parentElement?.closest<HTMLElement>("[data-vh-scroll-axis]");
  const axis = scroll?.dataset.vhScrollAxis;
  return axis === "x" || axis === "y" ? axis : undefined;
};

const constraintsFor = (
  constraints: DraggableMotionProps["dragConstraints"],
  node: MotionNodeHandle,
  origin: { readonly x: number; readonly y: number },
): DragConstraints | undefined => {
  if (!constraints) return undefined;
  if ("current" in constraints) {
    const bounds = constraints.current?.measure();
    const box = node.measure();
    if (!bounds || !box) return undefined;
    return {
      left: origin.x + bounds.x - box.x,
      right: origin.x + bounds.x + bounds.width - (box.x + box.width),
      top: origin.y + bounds.y - box.y,
      bottom: origin.y + bounds.y + bounds.height - (box.y + box.height),
    };
  }
  return constraints;
};

const elastic = (
  value: number,
  min: number | undefined,
  max: number | undefined,
  amount: boolean | number | undefined,
): number => {
  const factor = amount === false ? 0 : typeof amount === "number" ? amount : 0.35;
  if (min !== undefined && value < min) return min + (value - min) * factor;
  if (max !== undefined && value > max) return max + (value - max) * factor;
  return value;
};

const dragInfo = (
  session: DragSession,
  point: { readonly x: number; readonly y: number },
  timeStamp: number,
): DragInfo => {
  const delta = { x: point.x - session.lastPoint.x, y: point.y - session.lastPoint.y };
  const offset = { x: point.x - session.point.x, y: point.y - session.point.y };
  const elapsed = Math.max(1, timeStamp - session.lastTime);
  return {
    delta,
    offset,
    point,
    velocity: { x: (delta.x / elapsed) * 1000, y: (delta.y / elapsed) * 1000 },
  };
};

/** Maps pointer streams to the shared drag semantics without exposing DOM events publicly. */
export const useDomDrag = (
  elementRef: RefObject<DomElement | null>,
  node: MotionNodeHandle,
  props: DraggableMotionProps,
  controller: DomMotionController,
  callbacks: { readonly onStart?: () => void; readonly onEnd?: () => void } = {},
): DomDragHandlers => {
  const session = useRef<DragSession | null>(null);
  const startFromControls = (event: MotionGestureEvent) => {
    if (!props.drag) return;
    const origin = controller.getVisualStyle();
    session.current = {
      constraints: constraintsFor(props.dragConstraints, node, {
        x: origin.x ?? 0,
        y: origin.y ?? 0,
      }),
      lastPoint: event.point,
      lastTime: event.timeStamp,
      lockedAxis: undefined,
      origin: { x: origin.x ?? 0, y: origin.y ?? 0 },
      point: event.point,
      pointerId: event.pointerId,
      won: true,
    };
    callbacks.onStart?.();
    props.onDragStart?.(event, {
      delta: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      point: event.point,
      velocity: { x: 0, y: 0 },
    });
  };
  useDragControlRegistration(
    props.dragControls,
    props.dragListener === false ? startFromControls : undefined,
  );

  const finish = (event: PointerEvent<HTMLElement>) => {
    const current = session.current;
    session.current = null;
    if (!current?.won) return;
    const normalized = pointFromEvent(event);
    const info = dragInfo(current, normalized.point, normalized.timeStamp);
    props.onDragEnd?.(normalized, info);
    callbacks.onEnd?.();
    if (props.dragMomentum !== false) {
      const target = {
        x: elastic(
          current.origin.x + info.offset.x + info.velocity.x * 0.2,
          current.constraints?.left,
          current.constraints?.right,
          false,
        ),
        y: elastic(
          current.origin.y + info.offset.y + info.velocity.y * 0.2,
          current.constraints?.top,
          current.constraints?.bottom,
          false,
        ),
      };
      controller.animateTo(target, { type: "spring", ...props.dragTransition });
    }
  };

  return {
    touchAction: !props.drag
      ? "manipulation"
      : props.drag === "x"
        ? "pan-y"
        : props.drag === "y"
          ? "pan-x"
          : "none",
    onPointerDown: (event) => {
      if (!props.drag || props.dragListener === false) return;
      controller.stop();
      const origin = controller.getVisualStyle();
      session.current = {
        constraints: constraintsFor(props.dragConstraints, node, {
          x: origin.x ?? 0,
          y: origin.y ?? 0,
        }),
        lastPoint: { x: event.clientX, y: event.clientY },
        lastTime: event.timeStamp,
        lockedAxis: undefined,
        origin: { x: origin.x ?? 0, y: origin.y ?? 0 },
        point: { x: event.clientX, y: event.clientY },
        pointerId: event.pointerId,
        won: false,
      };
    },
    onPointerMove: (event) => {
      const current = session.current;
      if (!current || current.pointerId !== event.pointerId || !props.drag) return;
      const normalized = pointFromEvent(event);
      const info = dragInfo(current, normalized.point, normalized.timeStamp);
      const movement = Math.hypot(info.offset.x, info.offset.y);
      const direction = Math.abs(info.offset.x) >= Math.abs(info.offset.y) ? "x" : "y";
      current.lockedAxis ??= props.dragDirectionLock ? direction : undefined;
      if (!current.won) {
        if (movement < 3) return;
        const winner = resolveDragGestureWinner({
          direction: current.lockedAxis ?? direction,
          drag: props.drag,
          gesturePriority: props.gesturePriority,
          scrollAxis: nearestScrollAxis(event.currentTarget),
        });
        if (winner !== "drag") {
          session.current = null;
          return;
        }
        current.won = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        callbacks.onStart?.();
        props.onDragStart?.(normalized, info);
      }
      event.preventDefault();
      const xOffset = current.lockedAxis === "y" ? 0 : info.offset.x;
      const yOffset = current.lockedAxis === "x" ? 0 : info.offset.y;
      const x = elastic(
        current.origin.x + xOffset,
        current.constraints?.left,
        current.constraints?.right,
        props.dragElastic,
      );
      const y = elastic(
        current.origin.y + yOffset,
        current.constraints?.top,
        current.constraints?.bottom,
        props.dragElastic,
      );
      controller.setVisualStyle({ x, y });
      props.onDrag?.(normalized, info);
      current.lastPoint = normalized.point;
      current.lastTime = normalized.timeStamp;
    },
    onPointerUp: finish,
    onPointerCancel: finish,
  };
};
