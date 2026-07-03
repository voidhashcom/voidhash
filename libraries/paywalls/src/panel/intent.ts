/**
 * The serializable intents a panel definition emits when the author calls
 * `ctx.props.<name>.set` / `.cancel` / `.reset`. Like the {@link PanelTree}
 * event channel, intents never carry functions — the host receives them,
 * validates them against the component manifest, and reduces them into document
 * mutations. `set-prop` values are {@link PanelJsonValue}s bounded by
 * {@link PANEL_CAPS.intentBytes}.
 */
import type { PanelJsonValue } from "../schema/panel-tree";
import type { PanelGesture } from "./context";

/** Write a new value to a prop (transient during a drag, or final on commit). */
export interface SetPropIntent {
  readonly type: "set-prop";
  readonly name: string;
  readonly value: PanelJsonValue;
  readonly gesture: PanelGesture;
}

/** Rebind a `p.ref` prop to a different runtime entity. */
export interface SetRefIntent {
  readonly type: "set-ref";
  readonly name: string;
  readonly productId: string;
}

/** Reset a prop to its declared default. */
export interface ResetPropIntent {
  readonly type: "reset-prop";
  readonly name: string;
}

/** Commit the in-flight gesture (the last `live` value becomes final). */
export interface GestureCommitIntent {
  readonly type: "gesture-commit";
  readonly name: string;
}

/** Discard the in-flight gesture (revert to the value before it started). */
export interface GestureDiscardIntent {
  readonly type: "gesture-discard";
  readonly name: string;
}

/** The closed union of every intent a panel emits. */
export type PanelIntent =
  | SetPropIntent
  | SetRefIntent
  | ResetPropIntent
  | GestureCommitIntent
  | GestureDiscardIntent;
