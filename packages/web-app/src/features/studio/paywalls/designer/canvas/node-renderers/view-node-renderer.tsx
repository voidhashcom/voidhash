import type { ViewSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useStore } from "zustand";

import { usePaywallDesignerStore } from "../../state/designer-store";
import { localizedBackgroundImage, selectDefaultLocale } from "../../state/utils/localization";
import {
  getSelectedStateIdForNode,
  resolveEffectiveStyle,
} from "../../state/utils/state-overrides";
import { Selectable } from "../helpers/selectable";
import { FlexLayoutRenderer } from "./layouts/flex-layout-renderer";

export function ViewNodeRenderer({
  node,
  children,
  ref,
}: {
  node: ViewSnapshotNode;
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
  ) as ViewSnapshotNode["data"]["style"];
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

  return (
    <Selectable nodeId={node.id}>
      {(selectableProps) => (
        <FlexLayoutRenderer style={style} {...selectableProps} ref={ref}>
          {children}
        </FlexLayoutRenderer>
      )}
    </Selectable>
  );
}
