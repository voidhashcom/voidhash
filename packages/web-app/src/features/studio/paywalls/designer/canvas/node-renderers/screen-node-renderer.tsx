import type { ScreenSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { buildScreenContainerStyles } from "@voidhash/paywall-renderer-web-core";
import { useStore } from "zustand";

import { usePaywallDesignerStore } from "../../state/designer-store";
import { localizedBackgroundImage, selectDefaultLocale } from "../../state/utils/localization";
import {
  getSelectedStateIdForNode,
  resolveEffectiveStyle,
} from "../../state/utils/state-overrides";
import { Selectable } from "../helpers/selectable";
import { FlexLayoutRenderer } from "./layouts/flex-layout-renderer";

export function ScreenNodeRenderer({
  node,
  children,
  ref,
}: {
  node: ScreenSnapshotNode;
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
  const effectiveStyle = resolveEffectiveStyle(node, selectedStateId) as ScreenSnapshotNode["data"]["style"];
  // Substitute the locale-specific background image ONLY when a real override
  // exists — otherwise the render style stays byte-identical to today's.
  const localizedBg = localizedBackgroundImage(node.data, activeLocale, defaultLocale);
  const renderStyle =
    localizedBg === null ? effectiveStyle : { ...effectiveStyle, backgroundImage: localizedBg };

  const width = overrideDims?.width ?? effectiveStyle.width;
  const height = overrideDims?.height ?? effectiveStyle.height;

  return (
    <div className="absolute" ref={ref} style={{ left: node.data.style.x, top: node.data.style.y }}>
      <Selectable nodeId={node.id}>
        {(selectableProps) => (
          <div
            style={{
              ...(buildScreenContainerStyles(renderStyle) as React.CSSProperties),
              width,
              height,
            }}
            {...selectableProps}
          >
            <FlexLayoutRenderer
              initialStyle={{
                height,
                width,
              }}
              style={{
                ...renderStyle,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                borderBottomLeftRadius: 0,
              }}
            >
              {children}
            </FlexLayoutRenderer>
          </div>
        )}
      </Selectable>
    </div>
  );
}
