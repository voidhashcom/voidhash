import type { Primitive } from "@voidhash/mimic-core";

import type {
  componentPropBindingSchema,
  componentPropValueSchema,
} from "../component-bindings/index.ts";
import type { ComponentNodeData } from "../nodes/component-node.ts";
import type { localizationConfigSchema } from "../nodes/root-node.ts";
import type { TextNodeData } from "../nodes/text-node.ts";
import type { ViewNodeData } from "../nodes/view-node.ts";
import type { backgroundImage } from "../styles/index.ts";

/**
 * A decoded array element that may still be wrapped in its CRDT ordered-entry
 * envelope (`{ id, pos, value }`). Localization helpers accept either form.
 */
export type MaybeEntry<T> = T | Primitive.ArrayEntrySnapshot<T>;

type ArrayElement<A> = A extends readonly (infer T)[] ? T : never;
type EntryValue<E> = E extends Primitive.ArrayEntrySnapshot<infer V> ? V : E;
type ComponentPropSnapshot = NonNullable<
  EntryValue<ArrayElement<ComponentNodeData["data"]["props"]>>
>;

/**
 * Document-wide localization config as decoded from the root node. `locales`
 * entries are CRDT-entry-wrapped in the decoded snapshot; use the resolvers
 * (or {@link MaybeEntry} unwrapping) rather than reading `.tag` directly.
 */
export type LocalizationConfig = NonNullable<
  Primitive.InferSnapshot<typeof localizationConfigSchema>
>;

/** Decoded whole-value background image (`url` + `resizeMode`). */
export type BackgroundImageSnapshot = NonNullable<Primitive.InferSnapshot<typeof backgroundImage>>;

/** Decoded literal component-prop value (the payload of a literal binding). */
export type ComponentPropValueSnapshot = NonNullable<
  Primitive.InferSnapshot<typeof componentPropValueSchema>
>;

/** Decoded component-prop binding — a literal value or a variable reference. */
export type ComponentPropBindingSnapshot = NonNullable<
  Primitive.InferSnapshot<typeof componentPropBindingSchema>
>;

/** Decoded value of a single text `localized` entry. */
export type LocalizedTextOverride = NonNullable<
  EntryValue<ArrayElement<NonNullable<TextNodeData["data"]["localized"]>>>
>;

/** Decoded value of a single view/screen `localized` entry. */
export type LocalizedImageOverride = NonNullable<
  EntryValue<ArrayElement<NonNullable<ViewNodeData["data"]["localized"]>>>
>;

/** Decoded value of a single component-prop `localizedValues` entry. */
export type LocalizedPropOverride = NonNullable<
  EntryValue<ArrayElement<NonNullable<ComponentPropSnapshot["localizedValues"]>>>
>;

/** Minimal decoded text-node data the text resolver reads. */
export interface LocalizableTextData {
  readonly text: string;
  readonly localized?: TextNodeData["data"]["localized"];
}

/** Minimal decoded view/screen-node data the background-image resolver reads. */
export interface LocalizableImageData {
  readonly style: { readonly backgroundImage: BackgroundImageSnapshot };
  readonly localized?: ViewNodeData["data"]["localized"];
}

/** Minimal decoded component-prop entry the prop-value resolver reads. */
export interface LocalizableComponentProp {
  readonly value: ComponentPropBindingSnapshot;
  readonly localizedValues?: ComponentPropSnapshot["localizedValues"];
}

/** A descriptor for a component prop that can carry localized overrides. */
export interface LocalizablePropDescriptor {
  readonly propName: string;
  readonly label: string;
}

/**
 * One authorable localization target discovered on the document tree. `screenId`
 * is the id of the containing screen node (its own id for a screen's own image).
 */
export type LocalizableSlot =
  | {
      readonly kind: "text";
      readonly nodeId: string;
      readonly label: string;
      readonly baseValue: string;
      readonly screenId: string;
    }
  | {
      readonly kind: "image";
      readonly nodeId: string;
      readonly label: string;
      readonly baseValue: BackgroundImageSnapshot;
      readonly screenId: string;
    }
  | {
      readonly kind: "componentProp";
      readonly nodeId: string;
      readonly propName: string;
      readonly label: string;
      readonly baseValue: ComponentPropValueSnapshot;
      readonly screenId: string;
    };

export interface CollectLocalizableSlotsOptions {
  /**
   * Maps a component node to the subset of its props that are localizable.
   * mimic-schema is manifest-agnostic, so callers supply this from the resolved
   * component manifest. Props not returned here are skipped.
   */
  readonly getLocalizableProps?: (node: ComponentNodeData) => readonly LocalizablePropDescriptor[];
}
