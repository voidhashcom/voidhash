/**
 * The action schema builder passed to `defineComponent`. Declared actions
 * surface in two places: the component manifest (contract §2, so the visual
 * editor can bind to them) and the template's `actions` context, where each
 * action is a typed callback that invokes the consumer-passed prop of the
 * same name (e.g. action `onSelect` → component prop `onSelect`).
 */
import { brandActionCallback } from "../internal/action-brand";
import type { ManifestActionPayloadKind } from "../schema/component-manifest";

/** Describes one scalar field of an action payload. */
export class ActionPayloadBuilder<T> {
  declare readonly __value: T;
  readonly kind: ManifestActionPayloadKind;

  constructor(kind: ManifestActionPayloadKind) {
    this.kind = kind;
  }
}

/** The payload shape of an action: scalar fields only. */
export type ActionPayloadShape = Record<string, ActionPayloadBuilder<unknown>>;

/** A declared action, optionally carrying a payload shape. */
export class ActionBuilder<S extends ActionPayloadShape | undefined> {
  declare readonly __payload: S;
  readonly payloadShape: ActionPayloadShape | undefined;

  constructor(payloadShape: ActionPayloadShape | undefined) {
    this.payloadShape = payloadShape;
  }
}

/** Any action builder, used as the constraint for action maps. */
export type AnyActionBuilder = ActionBuilder<ActionPayloadShape | undefined>;

/** A record of action builders, as returned by an `actions` callback. */
export type ActionMap = Record<string, AnyActionBuilder>;

/** The `a` builder factory handed to a `defineComponent({ actions })` callback. */
export interface ActionFactory {
  /** Declares an action without a payload. */
  action(): ActionBuilder<undefined>;
  /** Declares an action carrying a typed scalar payload. */
  action<S extends ActionPayloadShape>(payload: S): ActionBuilder<S>;
  string(): ActionPayloadBuilder<string>;
  number(): ActionPayloadBuilder<number>;
  boolean(): ActionPayloadBuilder<boolean>;
}

function buildAction(): ActionBuilder<undefined>;
function buildAction<S extends ActionPayloadShape>(
  payload: S,
): ActionBuilder<S>;
function buildAction<S extends ActionPayloadShape>(
  payload?: S,
): ActionBuilder<S | undefined> {
  return new ActionBuilder<S | undefined>(payload);
}

export const actionFactory: ActionFactory = {
  action: buildAction,
  string: () => new ActionPayloadBuilder<string>("string"),
  number: () => new ActionPayloadBuilder<number>("number"),
  boolean: () => new ActionPayloadBuilder<boolean>("boolean"),
};

/** The payload object type of an action payload shape. */
export type InferActionPayload<S extends ActionPayloadShape> = {
  [K in keyof S]: S[K] extends ActionPayloadBuilder<infer T> ? T : never;
};

/**
 * The typed callbacks a component template receives: one per declared action,
 * each forwarding to the consumer-passed prop of the same name.
 */
export type InferActions<A extends ActionMap> = {
  [K in keyof A]: A[K] extends ActionBuilder<infer S>
    ? S extends ActionPayloadShape
      ? (payload: InferActionPayload<S>) => void
      : () => void
    : never;
};

/**
 * The optional handler props a *consumer* of the component may pass, one per
 * declared action (same name, e.g. `onSelect`).
 */
export type ActionHandlerProps<A extends ActionMap> = {
  [K in keyof A]?: A[K] extends ActionBuilder<infer S>
    ? S extends ActionPayloadShape
      ? (payload: InferActionPayload<S>) => void
      : () => void
    : never;
};

/**
 * Builds the template-facing action callbacks. Each callback reads the
 * *latest* consumer handlers through `getHandlers` (so identities stay stable
 * across renders) and is branded with its action name so `<Pressable
 * onPress={actions.onSelect}>` can record the action in preview trees.
 */
export const buildActionCallbacks = <A extends ActionMap>(
  actionMap: A,
  getHandlers: () => Record<string, unknown>,
): InferActions<A> => {
  const callbacks: Record<string, (payload?: unknown) => void> = {};
  for (const name of Object.keys(actionMap)) {
    callbacks[name] = brandActionCallback((payload?: unknown) => {
      const handler = getHandlers()[name];
      if (typeof handler === "function") {
        handler(payload);
      }
    }, name);
  }
  // Safe: one callback per `A` key, matching the `InferActions<A>` signatures
  // (payload is forwarded verbatim).
  return callbacks as InferActions<A>;
};
