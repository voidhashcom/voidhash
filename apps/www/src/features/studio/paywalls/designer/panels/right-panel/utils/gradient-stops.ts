import type { GradientStop } from "../../../state/actions/features/fill-style-actions";

/**
 * Chooses the position for a newly inserted gradient stop: the midpoint of the
 * largest gap across the clamped `[0, 1]` domain, including the two edge spans
 * `[0, firstStop]` and `[lastStop, 1]` so a stop can land past the outermost
 * stops. Falls back to `0.5` when there are no stops. With all stops at the
 * same position the largest span is always an edge span, so the result is a
 * real midpoint that never duplicates an existing stop.
 */
export function nextStopPosition(stops: GradientStop[]): number {
  if (stops.length === 0) return 0.5;
  const sorted = [...stops].map((s) => s.position).sort((a, b) => a - b);
  const bounds = [0, ...sorted, 1];
  let bestGap = -1;
  let bestPos = 0.5;
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i]!;
    const b = bounds[i + 1]!;
    const gap = b - a;
    if (gap > bestGap) {
      bestGap = gap;
      bestPos = a + gap / 2;
    }
  }
  return bestPos;
}
