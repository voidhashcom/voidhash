"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";

import { useAuth } from "@/features/studio/components/auth-context";
import { listPaywallsOptions } from "@/features/studio/lib/tanstack-query/paywalls";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

/**
 * The identifiers the code tab needs to derive a component's workspace path: the
 * backing `projectId` and the paywall's stable `slug`. Resolved from the route +
 * the authenticated user's project list; `null` until they can be resolved
 * (project not found, paywall list not loaded, or slug unknown).
 */
export interface PaywallCodeTarget {
  projectId: string;
  paywallSlug: string;
}

/**
 * Resolves the current designer's {@link PaywallCodeTarget} from the route params
 * and the paywall list query. Returns `null` while the project or the paywall's
 * slug cannot yet be resolved.
 */
export function usePaywallCodeTarget(): PaywallCodeTarget | null {
  const { user } = useAuth();
  const { organizationSlug, projectSlug, id: paywallId } = useParams({ strict: false });

  const projectId = useMemo(
    () =>
      organizationSlug && projectSlug
        ? (CurrentUser.getProjectBySlugs(user, organizationSlug, projectSlug)?.id ?? null)
        : null,
    [user, organizationSlug, projectSlug],
  );

  const { data: paywalls } = useQuery({
    ...listPaywallsOptions({ projectId: projectId ?? "" }),
    enabled: projectId !== null,
  });

  return useMemo(() => {
    if (projectId === null || paywallId === undefined) {
      return null;
    }
    const slug = paywalls?.find((paywall) => paywall.id === paywallId)?.slug;
    return slug === undefined ? null : { projectId, paywallSlug: slug };
  }, [projectId, paywallId, paywalls]);
}
