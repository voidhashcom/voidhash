import type { MimicSlice } from '@voidhash/mimic-react/zustand';
import type {
  PaywallDesignerDocument,
  PresenceSchema
} from '@voidhash/mimic-schema';

export type AvailableTool =
  | 'cursor'
  | 'text'
  | 'rows'
  | 'columns'
  | 'scroll-view';

export type DesignerStoreState = MimicSlice<
  typeof PaywallDesignerDocument,
  typeof PresenceSchema
> & {
  debug: {
    showGrid: boolean;
  };
  highlightedNodeId: string | null;
  textEditingNodeId: string | null;
  tools: {
    activeTool: string;
  };
  canvas: {
    scale: number;
    x: number;
    y: number;
    boundingBoxes: Record<
      string,
      { x: number; y: number; width: number; height: number }
    >;
  };
  viewport: {
    panels: {
      top: { height: number };
      bottom: { height: number };
      left: { width: number };
      right: { width: number };
    };
  };
};
