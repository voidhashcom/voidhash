"use client";

import { Button } from "@voidhash/ui";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useStore } from "zustand/react";

import { setPreviewScale } from "../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../state/designer-store";

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

export function ZoomControls() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const scale = useStore(store, (state) => state.previewScale);

  const zoomIn = () => {
    dispatch(setPreviewScale)({ scale: scale + ZOOM_STEP });
  };

  const zoomOut = () => {
    dispatch(setPreviewScale)({ scale: scale - ZOOM_STEP });
  };

  const resetZoom = () => {
    dispatch(setPreviewScale)({ scale: 1 });
  };

  return (
    <div className="flex items-center gap-1">
      <Button disabled={scale <= MIN_ZOOM} onClick={zoomOut} size="icon-sm" variant="ghost">
        <MinusIcon />
      </Button>
      <button
        className="min-w-14 px-2 text-muted-foreground text-xs transition-colors hover:text-foreground"
        onClick={resetZoom}
        type="button"
      >
        {Math.round(scale * 100)}%
      </button>
      <Button disabled={scale >= MAX_ZOOM} onClick={zoomIn} size="icon-sm" variant="ghost">
        <PlusIcon />
      </Button>
    </div>
  );
}
