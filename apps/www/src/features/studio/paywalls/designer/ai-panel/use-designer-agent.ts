"use client";

import { useParams } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type { SurfaceAgent } from "@/features/studio/ai";
import { useAuth } from "@/features/studio/components/auth-context";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

import { usePaywallDesignerStore } from "../state/designer-store";
import { selectedNodeIdsFromPresence } from "../state/utils/presence";

/**
 * Assembles the designer {@link SurfaceAgent} consumed by the AI panel: its
 * surface id, the request context (organization / project / paywall ids resolved
 * from the route + the authenticated user) and its live selection context.
 *
 * `getDynamicContext` carries the current node selection with each send (read on
 * demand, not subscribed). All tools execute on the server against the same
 * mimic document observed by the canvas.
 */
export function useDesignerAgent(): SurfaceAgent {
  const { user } = useAuth();
  const store = usePaywallDesignerStore();
  const { organizationSlug, projectSlug, id: paywallId } = useParams({ strict: false });

  const getDynamicContext = useCallback(
    () => ({
      selectedNodeIds: selectedNodeIdsFromPresence(store.getState().mimic.presence?.self),
    }),
    [store],
  );

  const organization = useMemo(
    () =>
      organizationSlug
        ? user.organizations.find((candidate) => candidate.slug === organizationSlug)
        : undefined,
    [user, organizationSlug],
  );
  const project = useMemo(
    () =>
      organizationSlug && projectSlug
        ? CurrentUser.getProjectBySlugs(user, organizationSlug, projectSlug)
        : null,
    [user, organizationSlug, projectSlug],
  );

  const projectId = project?.id ?? "";

  return useMemo<SurfaceAgent>(
    () => ({
      surfaceId: "designer",
      context: {
        organizationId: organization?.id ?? "",
        projectId,
        paywallId,
      },
      getDynamicContext,
      // Designer chats are context-specific and resumable: scoped to the paywall
      // and listed in the panel's history dropdown.
      persistence: { mode: "persistent" },
    }),
    [organization?.id, projectId, paywallId, getDynamicContext],
  );
}
