/**
 * Precise static prop types for the compose author surface's built-in tags.
 *
 * These are TYPE-ONLY: every import erases, so this module adds nothing to the
 * compose runtime graph (which must stay react/mimic-free). The per-node style
 * fields are authored inside a single `style={{ … }}` object (converging with the
 * code-component authoring look) and are derived from the shared
 * `../schema/style-registry` value-type descriptors, so a typo'd style key or a
 * wrong-typed value on `<Screen>`/`<View>`/`<Text>` errors at type-check time
 * (Monaco + real tsc), not only at parse/encode time. Non-style attributes
 * (`name`, `onPress`, children) are siblings of `style`, from the PARSER's
 * accepted surface, not the style registry:
 *
 * - `name` — an optional display-name string on every node (parser: any node).
 * - `onPress` — a bound {@link Action}, `<View>` only (parser rejects it on
 *   Screen/Text).
 * - children — layout nodes take element children; `<Text>` takes a literal
 *   string (its content is JSX text).
 */
import type {
  NODE_STYLE_ENTRIES,
  StyleFieldName,
  StyleFieldValue,
} from "../schema/style-registry";
import type { Action } from "./author-surface";

/** The composition node the caller of {@link NodeStyleProps} is typing. */
type NodeKind = keyof typeof NODE_STYLE_ENTRIES;

/** The union of style field names a node type's entry list carries. */
type NodeStyleFieldName<K extends NodeKind> = (typeof NODE_STYLE_ENTRIES)[K][number]["field"] &
  StyleFieldName;

/**
 * The style fields accepted by a node type inside its `style={{ … }}` object: one
 * optional key per registry field, typed by that field's descriptor. All optional
 * — every style field has a schema default, so omitting it is legal.
 */
export type NodeStyleProps<K extends NodeKind> = {
  readonly [F in NodeStyleFieldName<K>]?: StyleFieldValue<F>;
};

/** A layout child of `<Screen>`/`<View>`: another built-in or component node. */
type LayoutChild = unknown;

/**
 * `<Screen>` props: a single `style` object + optional name + element children.
 * Style fields are authored inside `style={{ … }}`, converging with the
 * code-component authoring look.
 */
export type ScreenProps = {
  readonly style?: NodeStyleProps<"screen">;
  readonly name?: string;
  readonly children?: LayoutChild | readonly LayoutChild[];
};

/** `<View>` props: a `style` object + optional name + `onPress` action + element children. */
export type ViewProps = {
  readonly style?: NodeStyleProps<"view">;
  readonly name?: string;
  /** A node interaction bound to press/click. `<View>` only. */
  readonly onPress?: Action;
  readonly children?: LayoutChild | readonly LayoutChild[];
};

/** `<Text>` props: a `style` object + optional name + a literal string child (its content). */
export type TextProps = {
  readonly style?: NodeStyleProps<"text">;
  readonly name?: string;
  readonly children?: string;
};
