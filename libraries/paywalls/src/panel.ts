/**
 * `@voidhash/paywalls/panel` — data-only editor panel primitives.
 *
 * Phase 1 stub: a `defineComponent({ panel: <Panel>…</Panel> })` declaration
 * is accepted and carried on the definition, but no panel behaviour is emitted
 * yet. The elements are inert (they render `null`) — a later phase compiles
 * them to a JSON panel specification, so no author JS ever runs in the editor.
 */
import type { ReactNode } from "react";

export interface PanelProps {
  children?: ReactNode;
}

export interface PanelSectionProps {
  title?: string;
  children?: ReactNode;
}

export interface PanelFieldProps {
  /** The declared prop this field edits. */
  name: string;
  label?: string;
  children?: ReactNode;
}

const PanelRoot = (_props: PanelProps): ReactNode => null;
PanelRoot.displayName = "Panel";

const PanelSection = (_props: PanelSectionProps): ReactNode => null;
PanelSection.displayName = "Panel.Section";

const PanelField = (_props: PanelFieldProps): ReactNode => null;
PanelField.displayName = "Panel.Field";

/**
 * Root of a component's custom editor panel. Compose with `Panel.Section` and
 * `Panel.Field`; the structure is data-only and renders nothing at runtime.
 */
export const Panel = Object.assign(PanelRoot, {
  Field: PanelField,
  Section: PanelSection,
});
