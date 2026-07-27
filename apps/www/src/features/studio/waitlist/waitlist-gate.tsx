"use client";

import { Navigate, useLocation, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAuth } from "@/features/studio/components/auth-context";
import { isOrganizationWaitlisted } from "@/lib/waitlist";

/** The holding screen waitlisted organizations are redirected to. */
export const WAITLIST_PATH = "/studio/waitlist";

/**
 * Blocks Studio for organizations that are still on the waitlist, redirecting
 * to {@link WAITLIST_PATH} instead of rendering the dashboard.
 *
 * Wraps the whole `/studio/_authenticated` subtree so deep links are covered
 * too, and resolves the organization from the active `$organizationSlug` route
 * param. Routes with no slug (`/studio`, `/studio/create-organization`) are
 * only blocked when *every* one of the user's organizations is waitlisted, so
 * a member of one approved and one waitlisted organization is not held out of
 * the approved one.
 *
 * Users with no organization yet are let through so they can still reach
 * `/studio/create-organization`; the gate picks the organization up on the
 * next render once it exists.
 *
 * The slug is read off the leaf match rather than with
 * `useParams({ strict: false })`: this component renders at the
 * `/studio/_authenticated` layout, and `useParams` resolves against the
 * *nearest* match, which at a layout does not yet carry the child's params.
 */
export function WaitlistGate({ children }: { readonly children: ReactNode }) {
  const { user } = useAuth();
  const pathname = useLocation({ select: (location) => location.pathname });
  const organizationSlug = useRouterState({
    select: (state) =>
      (state.matches.at(-1)?.params as { organizationSlug?: string } | undefined)
        ?.organizationSlug,
  });

  const organizationInContext = organizationSlug
    ? user.organizations.find((organization) => organization.slug === organizationSlug)
    : (user.organizations.find((organization) => !isOrganizationWaitlisted(organization)) ??
      user.organizations[0]);

  const blocked =
    pathname !== WAITLIST_PATH &&
    organizationInContext !== undefined &&
    isOrganizationWaitlisted(organizationInContext);

  if (blocked) {
    return <Navigate replace to={WAITLIST_PATH} />;
  }

  return <>{children}</>;
}
