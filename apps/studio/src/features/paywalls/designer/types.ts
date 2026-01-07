import type { Viewport } from "pixi-viewport";

export interface ViewportState {
  zoom: number;
  x: number;
  y: number;
}

export interface ViewportControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  zoomToFit: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  setZoom: (zoom: number) => void;
  panTo: (x: number, y: number) => void;
}

export interface CanvasViewportContext {
  viewport: Viewport | null;
  state: ViewportState;
  controls: ViewportControls;
}

export interface DesignerCanvasProps {
  children?: React.ReactNode;
}

// ================================
// Nodes
// ================================
abstract class BaseNode {
  private _id: string;
  constructor(id: string) {
    this._id = id;
  }
  get id() {
    return this._id;
  }
}

abstract class CanvasNode extends BaseNode {
  protected width: number;
  protected height: number;
  protected x: number;
  protected y: number;

  constructor(id: string, width: number, height: number, x: number, y: number) {
    super(id);
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
  }
}

export class ScreenNode extends CanvasNode {
  protected width: number;
  protected height: number;

  constructor(id: string, width: number, height: number, x: number, y: number) {
    super(id, width, height, x, y);
    this.width = width;
    this.height = height;
  }
}

export type AnyNode = ScreenNode;
export type AnyRenderableNodes = ScreenNode;
