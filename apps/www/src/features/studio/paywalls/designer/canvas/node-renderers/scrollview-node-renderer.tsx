import type { ScrollViewSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useStore } from "zustand";

import { usePaywallDesignerStore } from "../../state/designer-store";
import { localizedBackgroundImage, selectDefaultLocale } from "../../state/utils/localization";
import {
  getSelectedStateIdForNode,
  resolveEffectiveStyle,
} from "../../state/utils/state-overrides";
import { Selectable } from "../helpers/selectable";
import { FlexLayoutRenderer } from "./layouts/flex-layout-renderer";

/**
 * Edit-canvas renderer for a `scrollView` node. Mirrors the view renderer's
 * flex layout + resize/state handling, then layers the RN ScrollView overflow
 * semantics on top via `initialStyle`: vertical scroll by default, horizontal
 * (row flow) when `horizontal`, and scrollbar suppression when
 * `showsScrollIndicator` is false. The overflow is applied here rather than in
 * `buildScrollViewStyles` because the canvas builds base styles through
 * `FlexLayoutRenderer`/`buildViewStyles`; the CSS lowering is identical.
 */
export function ScrollViewNodeRenderer({
  node,
  children,
  ref,
}: {
  node: ScrollViewSnapshotNode;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  const store = usePaywallDesignerStore();
  const overrideDims = useStore(store, (state) => {
    const { resize } = state;
    if (!resize.isActive) {
      return null;
    }
    return resize.currentNodeDimensions[node.id] ?? null;
  });
  const selectedStateId = useStore(store, (state) =>
    getSelectedStateIdForNode(state.stateOverrideSelection, node.id),
  );
  const activeLocale = useStore(store, (state) => state.activeLocale);
  const defaultLocale = useStore(store, selectDefaultLocale);

  const effectiveStyle = resolveEffectiveStyle(
    node,
    selectedStateId,
  ) as ScrollViewSnapshotNode["data"]["style"];
  // Substitute the locale-specific background image ONLY when a real override
  // exists for the active locale — otherwise leave the state-resolved style
  // byte-identical to today's behavior.
  const localizedBg = localizedBackgroundImage(node.data, activeLocale, defaultLocale);
  const renderStyle =
    localizedBg === null ? effectiveStyle : { ...effectiveStyle, backgroundImage: localizedBg };

  const style = overrideDims
    ? {
        ...renderStyle,
        width: overrideDims.width ?? renderStyle.width,
        height: overrideDims.height ?? renderStyle.height,
      }
    : renderStyle;

  const overflowStyle: React.CSSProperties = node.data.horizontal
    ? { flexDirection: "row", overflowX: "auto", overflowY: "hidden" }
    : { overflowX: "hidden", overflowY: "auto" };
  const initialStyle: React.CSSProperties = {
    ...overflowStyle,
    WebkitOverflowScrolling: "touch",
    // Yoga defaults a flex item's min main size to 0, but CSS defaults it to
    // `auto` (content floor) — without `min-*: 0` a content-tall scrollView can
    // never shrink and `overflowY: auto` never engages. Mirror
    // `buildScrollViewStyles`, defaulting only when the author left it unset so
    // `buildViewStyles` (spread first via FlexLayoutRenderer) keeps its value.
    ...(style.minHeight === undefined ? { minHeight: 0 } : {}),
    ...(style.minWidth === undefined ? { minWidth: 0 } : {}),
    // Inline styles cannot target ::-webkit-scrollbar; scrollbarWidth hides it
    // on Firefox/standards engines only.
    ...(node.data.showsScrollIndicator ? {} : { scrollbarWidth: "none" }),
  };

  return (
    <Selectable nodeId={node.id}>
      {(selectableProps) => (
        <FlexLayoutRenderer
          style={style}
          initialStyle={initialStyle}
          {...selectableProps}
          ref={ref}
        >
          {children}
        </FlexLayoutRenderer>
      )}
    </Selectable>
  );
}
