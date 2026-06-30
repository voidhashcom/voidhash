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
  type ComponentPreviewState,
  type ComponentRenderContext,
  type DefineComponentInput,
  defineComponent,
  type InferComponentProps,
  isComponentDefinition,
  type PaywallComponent,
  type PaywallComponentMeta,
} from "./authoring/define-component";
export { extractComponentManifest } from "./authoring/manifest";
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
// ── Schema (shared wire types) ───────────────────────────────────────────────
export {
  PAYWALL_STYLE_KEYS,
  type PaywallAlignItems,
  type PaywallAlignSelf,
  type PaywallDimension,
  type PaywallFlexDirection,
  type PaywallFontWeight,
  type PaywallJustifyContent,
  type PaywallStyle,
  type StyleProp,
} from "./schema/style";
// ── Style ────────────────────────────────────────────────────────────────────
export { flattenStyle, resolveStyle } from "./style/resolve";
