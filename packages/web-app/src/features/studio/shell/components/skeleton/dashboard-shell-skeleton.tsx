import { useLocation } from "@tanstack/react-router";
import { Spinner } from "@voidhash/ui";

import { OrganizationLayoutSkeleton } from "./organization-layout-skeleton";
import { ProjectLayoutSkeleton } from "./project-layout-skeleton";

const STUDIO_RESERVED_SEGMENTS = new Set(["create-organization", "_designer"]);
const STUDIO_PATH = /^\/studio\/([^/]+)(?:\/([^/]+))?(?:\/.*)?$/;

export function DashboardShellSkeleton() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const match = pathname.match(STUDIO_PATH);

  if (!match) {
    return <CenteredSpinner />;
  }

  const organizationSlug = match[1];
  const projectSlug = match[2];

  if (STUDIO_RESERVED_SEGMENTS.has(organizationSlug)) {
    return <CenteredSpinner />;
  }

  // `~` denotes an org-scoped sub-route (e.g. /studio/<org>/~/settings),
  // not a project slug — render the organization layout.
  if (projectSlug && projectSlug !== "~") {
    return (
      <ProjectLayoutSkeleton
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
      />
    );
  }

  return <OrganizationLayoutSkeleton organizationSlug={organizationSlug} />;
}

function CenteredSpinner() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Spinner />
    </div>
  );
}
