// ================================
// Debug
// ================================
export const SHOW_GRID = false;

export const CANVAS_DEFAULTS = {
  WORLD_WIDTH: 20_000,
  WORLD_HEIGHT: 20_000,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5,
  GRID_SIZE: 20,
  // Colors
  PRIMARY_COLOR: 0x00_5e_ff,
  GRID_COLOR: 0x3f_3f_3f,
  BACKGROUND_COLOR: '#121212'
} as const;

export const INIT_SCREEN_DATA = {
  x: 0,
  y: 0,
  width: 390,
  height: 844,
  backgroundColor: '#ffffff'
} as const;
