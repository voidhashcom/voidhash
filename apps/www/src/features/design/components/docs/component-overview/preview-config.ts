const previewConfig = {
  style: "nova",
} as const;

/**
 * Provides the upstream preview's default style selection.
 */
export function useDesignSystemSearchParams() {
  return [previewConfig] as const;
}
