/**
 * `@voidhash/paywalls` — the authoring API and runtime for code-driven
 * paywalls.
 *
 * Paywalls are written with a React-Native-like primitive set (`View`, `Text`,
 * `Pressable`, …) and rendered by a pluggable renderer. The default renderer
 * targets the DOM (Studio and the deployed WebView bundle); the Node-only
 * `@voidhash/paywalls/tree` entry renders the same components to the §3
 * preview node tree the visual editor consumes.
 */

export {
  ActionBuilder,
  type ActionFactory,
  type ActionHandlerProps,
  type ActionMap,
  ActionPayloadBuilder,
  type ActionPayloadShape,
  type AnyActionBuilder,
  type InferActionPayload,
  type InferActions,
} from "./authoring/actions";
// ── Authoring API ────────────────────────────────────────────────────────────
export {
  type Action,
  closePaywall,
  none,
  payload,
  product,
  type ProductRef,
  purchase,
  variable,
  type VariableHandle,
} from "./authoring/compose-values";
export {
  type CreatePaywallInput,
  createPaywall,
  isPaywallDefinition,
  type PaywallBody,
  type PaywallDefinition,
  type PaywallMeta,
  renderPaywallBody,
} from "./authoring/create-paywall";
export {
  type ComponentDefinition,
  type ComponentDefinitionFields,
  type ComponentPanel,
  type ComponentPreviewState,
  type ComponentRenderContext,
  type ComposeComponentProps,
  type DefineComponentInput,
  defineComponent,
  type InferComponentProps,
  isComponentDefinition,
  type PanelPropsFor,
  type PaywallComponent,
  type PaywallComponentMeta,
} from "./authoring/define-component";
export {
  type DefinePaywallInput,
  definePaywall,
  isPaywallCompositionDefinition,
  type PaywallCompositionDefinition,
  type PaywallCompositionMeta,
} from "./authoring/define-paywall";
export { extractComponentManifest } from "./authoring/manifest";
export { type ScreenProps, type ScreenStyle, Screen } from "./authoring/screen";
export {
  type AnyPropBuilder,
  type InferExternalProps,
  type InferProps,
  PropBuilder,
  type PropFactory,
  type PropKind,
  type PropMap,
  type PropSchema,
  type PropValueOf,
} from "./authoring/props";
// ── Primitives ───────────────────────────────────────────────────────────────
export { Image, Pressable, ScrollView, Text, View } from "./primitives/components";
export { RendererProvider, type RendererProviderProps, useHost } from "./primitives/host-context";
export { Slot, type SlotProps, SlotProvider } from "./primitives/slot";
export type {
  HostComponents,
  ImageProps,
  ImageSource,
  PressableHostProps,
  PressableProps,
  PressableState,
  ResizeMode,
  ScrollViewProps,
  SlotHostProps,
  TextProps,
  ViewProps,
} from "./primitives/types";
export { domHostComponents } from "./renderer/dom-host";
// ── Motion ─────────────────────────────────────────────────────────────────
export { MotionConfig, useMotionConfig, useReducedMotion } from "./motion/context";
export { domMotionPlatformAdapter, staticMotionPlatformAdapter, useMotionPlatform } from "./motion/platform";
export { useMotionValue, useMotionValueEvent, useSpring, useTransform, useVelocity } from "./motion/hooks";
export { useDragControls } from "./motion/drag";
export { useMotionRef } from "./motion/ref";
export { useInView, useScroll } from "./motion/scroll";
export { compileMotionCss, compileMotionTransform } from "./motion/transform";
export { motionValue, type MotionValue, type MotionValueEventName } from "./motion/value";
export {
  MOTION_STYLE_KEYS,
  type AnimationControls,
  type DragAxis,
  type DragConstraints,
  type DragControls,
  type DragInfo,
  type DraggableMotionProps,
  type MotionConfigProps,
  type MotionGestureEvent,
  type MotionLayoutBox,
  type MotionNodeHandle,
  type MotionPlatformAdapter,
  type MotionRef,
  type MotionScrollMetrics,
  type MotionStyle,
  type MotionStyleKey,
  type MotionStyleObject,
  type MotionStyleProp,
  type MotionTarget,
  type MotionTransformOrigin,
  type MotionVisualProps,
  type PressableMotionProps,
  type ReducedMotion,
  type ResolvedMotionStyle,
  type ScrollMotionValues,
  type ScrollViewHandle,
  type Transition,
  type TransitionByKey,
  type UseScrollOptions,
  type VariantLabel,
  type ViewportOptions,
} from "./motion/types";
// ── Renderer / runtime ───────────────────────────────────────────────────────
export { PaywallRenderer, type PaywallRendererProps } from "./renderer/paywall-renderer";
export {
  createDefaultBridge,
  NATIVE_INBOUND_GLOBAL,
  type PaywallBridge,
  STUDIO_HOST_MESSAGE_SOURCE,
  STUDIO_MESSAGE_SOURCE,
  subscribeToInboundEnvelopes,
} from "./runtime/bridge";
export {
  EMPTY_RUNTIME_CONFIG,
  normalizeRuntimeConfig,
  type PaywallPlatform,
  type PaywallProduct,
  type PaywallProductPeriod,
  type PaywallRuntimeConfig,
  type PaywallVariables,
  RUNTIME_CONFIG_GLOBAL,
  readInjectedConfig,
} from "./runtime/config";
export {
  createCloseEnvelope,
  createEventEnvelope,
  createOpenExternalEnvelope,
  createPurchaseEnvelope,
  createReadyEnvelope,
  createRestoreEnvelope,
  PAYWALL_BRIDGE_VERSION,
  type PaywallBridgeError,
  type PaywallCloseEnvelope,
  type PaywallConfigureEnvelope,
  type PaywallEventEnvelope,
  type PaywallInboundEnvelope,
  type PaywallLogEnvelope,
  type PaywallOpenExternalEnvelope,
  type PaywallOutboundActionType,
  type PaywallOutboundEnvelope,
  type PaywallPurchaseEnvelope,
  type PaywallReadyEnvelope,
  type PaywallResponseEnvelope,
  type PaywallRestoreEnvelope,
  type PaywallStatusEnvelope,
  type PaywallTransactionStatus,
  parseInboundEnvelope,
  serializeEnvelope,
} from "./runtime/envelope";
export {
  type PaywallActions,
  PaywallRuntimeProvider,
  type PaywallRuntimeProviderProps,
  type PaywallStatusSnapshot,
  usePaywallActions,
  usePaywallConfig,
  usePaywallProducts,
  usePaywallStatus,
  usePaywallVariables,
  useSelectedProduct,
} from "./runtime/runtime";
export {
  COMPONENT_MANIFEST_VERSION,
  type ComponentManifest,
  type ManifestAction,
  type ManifestActionPayloadKind,
  type ManifestArrayItem,
  type ManifestArrayProp,
  type ManifestBooleanProp,
  type ManifestComponentProp,
  type ManifestHostData,
  type ManifestImageProp,
  type ManifestNumberProp,
  type ManifestProp,
  type ManifestPropEditor,
  type ManifestPropKind,
  type ManifestRefProp,
  type ManifestRefType,
  type ManifestSelectProp,
  type ManifestStringProp,
} from "./schema/component-manifest";
export {
  PAYWALL_TREE_VERSION,
  type PaywallImageNode,
  type PaywallNode,
  type PaywallNodeResizeMode,
  type PaywallNodeTree,
  type PaywallPlaceholderNode,
  type PaywallPressableNode,
  type PaywallScrollNode,
  type PaywallSlotNode,
  type PaywallTextNode,
  type PaywallViewNode,
} from "./schema/node-tree";
export {
  type ActionEditorFieldNode,
  type AlignmentGridNode,
  type ButtonNode,
  type CalloutNode,
  type ColorFieldNode,
  type ColorPickerNode,
  type ColumnNode,
  type DefaultPropsNode,
  type DimensionFieldNode,
  type FieldNode,
  type FillFieldNode,
  type GradientStopsNode,
  type IconName,
  type ImageFieldNode,
  type MenuNode,
  PANEL_CAPS,
  PANEL_ICON_NAME_LIST,
  PANEL_NODE_SPECS,
  PANEL_TREE_VERSION,
  type PanelJsonValue,
  type PanelNode,
  type PanelNodeBase,
  type PanelNodeSpec,
  type PanelNodeType,
  type PanelRootNode,
  type PanelTree,
  type PopoverContentNode,
  type PopoverNode,
  type PopoverTriggerNode,
  type PropFieldNode,
  type ResetAffordanceNode,
  type RowNode,
  type SectionActionsNode,
  type SectionNode,
  type SelectFieldNode,
  type SliderFieldNode,
  type SubsectionNode,
  type SwatchNode,
  type SwitchFieldNode,
  type TextFieldNode,
  type TextNode,
  type ToggleGroupNode,
  type VariableFieldNode,
} from "./schema/panel-tree";
export {
  PANEL_ICON_NAMES,
  type ParsePanelResult,
  parsePanelTree,
} from "./schema/validate-panel";
// ── Schema (shared wire types) ───────────────────────────────────────────────
export {
  PAYWALL_STYLE_KEY_LIST,
  type PaywallAlignItems,
  type PaywallAlignSelf,
  type PaywallDimension,
  type PaywallFlexDirection,
  type PaywallFontWeight,
  type PaywallJustifyContent,
  type PaywallStyle,
  type StyleProp,
} from "./schema/style";
export {
  countSlotNodes,
  PAYWALL_STYLE_KEYS,
  type ParseResult,
  parseComponentManifest,
  parsePreviewTree,
  PREVIEW_STATE_PATTERN,
} from "./schema/validate";
// ── Style ────────────────────────────────────────────────────────────────────
export { flattenStyle, resolveStyle } from "./style/resolve";
/**
 * React hooks re-exported so authored paywall code needs only
 * `@voidhash/paywalls` imports — never a direct `react` import. They ARE
 * React's own hooks (paywall components are real React); this re-export keeps
 * a single, stable author-facing import surface.
 */
export { useCallback, useEffect, useMemo, useRef, useState } from "react";
