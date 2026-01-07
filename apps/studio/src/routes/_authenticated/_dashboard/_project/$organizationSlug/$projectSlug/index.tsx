import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/"
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      params: {
        organizationSlug: params.organizationSlug,
        projectSlug: params.projectSlug,
      },
      to: "/$organizationSlug/$projectSlug/paywalls",
    });
  },
});
