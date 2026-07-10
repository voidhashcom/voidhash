import type { ReactNode } from "react";

import { View } from "../primitives/components";
import type { PaywallStyle } from "../schema/style";

/**
 * The `<Screen>` style object type — the shared §3.1 wire style shape. A typo'd
 * key or wrong-typed value errors at type-check time.
 */
export type ScreenStyle = PaywallStyle;

/** Props accepted by the root `<Screen>` of a paywall composition. */
export interface ScreenProps {
  /** Optional inline node id (identity is otherwise the file/path). */
  readonly id?: string;
  /** Optional display name (`name=` attribute). */
  readonly name?: string;
  /** The screen's style object; see {@link ScreenStyle}. */
  readonly style?: ScreenStyle;
  readonly children?: ReactNode;
}

/**
 * The root layout primitive for a paywall preview. It is a REAL component that
 * lays out its children as a full-bleed flex column (adequate for preview
 * surfaces). The `id`/`name` annotations are inert metadata the runtime renderer
 * ignores.
 */
export const Screen = ({ style, children }: ScreenProps): ReactNode => (
  <View style={{ flex: 1, ...(style as Record<string, unknown>) }}>{children}</View>
);
Screen.displayName = "Screen";
