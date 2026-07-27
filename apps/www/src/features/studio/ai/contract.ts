/** Whether a session is listed in the history UI, or stored-but-hidden. */
export type AgentSessionPersistence = "persistent" | "single_use";

/** Agent surfaces currently supported by the studio session host. */
export type AgentSurface = "designer";

/** Coarse chat activity exposed to a host surface for ambient progress UI. */
export type SurfaceAgentActivity = { kind: "thinking"; label: string } | { kind: "idle" };

/** Controls whether a surface exposes durable sessions in its history menu. */
export interface SurfaceChatPersistence {
  mode: AgentSessionPersistence;
}

/** Scope and live context contributed by a studio surface to a durable agent session. */
export interface SurfaceAgent {
  readonly surfaceId: AgentSurface;
  readonly context: { organizationId: string; projectId: string; paywallId?: string };
  readonly getDynamicContext?: () => Record<string, unknown>;
  readonly onActivityChange?: (activity: SurfaceAgentActivity) => void;
  readonly persistence?: SurfaceChatPersistence;
}
