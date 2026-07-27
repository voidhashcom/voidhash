export const PANEL_DIMENSIONS = {
  /** Default width of the left (layers) panel (user-resizable at runtime). */
  LEFT_WIDTH: 240,
  /** Lower bound for the resizable left panel width. */
  LEFT_MIN_WIDTH: 200,
  /** Upper bound for the resizable left panel width. */
  LEFT_MAX_WIDTH: 400,
  /** Default width of the right (properties) panel (user-resizable at runtime). */
  RIGHT_WIDTH: 280,
  /** Lower bound for the resizable right panel width. */
  RIGHT_MIN_WIDTH: 240,
  /** Upper bound for the resizable right panel width. */
  RIGHT_MAX_WIDTH: 480,
  TOP_HEIGHT: 54,
  /** Default width of the Voidhash AI chat panel (user-resizable at runtime). */
  AI_CHAT_WIDTH: 320,
  /** Lower bound for the resizable AI chat panel width. */
  AI_CHAT_MIN_WIDTH: 280,
  /** Upper bound for the resizable AI chat panel width. */
  AI_CHAT_MAX_WIDTH: 560,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Clamp a left (layers) panel width to its resize bounds. */
export function clampLeftPanelWidth(width: number): number {
  return clamp(width, PANEL_DIMENSIONS.LEFT_MIN_WIDTH, PANEL_DIMENSIONS.LEFT_MAX_WIDTH);
}

/** Clamp a right (properties) panel width to its resize bounds. */
export function clampRightPanelWidth(width: number): number {
  return clamp(width, PANEL_DIMENSIONS.RIGHT_MIN_WIDTH, PANEL_DIMENSIONS.RIGHT_MAX_WIDTH);
}

/** Clamp an AI chat panel width to its resize bounds. */
export function clampAiPanelWidth(width: number): number {
  return clamp(width, PANEL_DIMENSIONS.AI_CHAT_MIN_WIDTH, PANEL_DIMENSIONS.AI_CHAT_MAX_WIDTH);
}
