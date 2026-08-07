import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/",
)({
  beforeLoad: ({ params }) => {
    return redirect({
      params: {
        organizationSlug: params.organizationSlug,
        projectSlug: params.projectSlug,
      },
      to: "/studio/$organizationSlug/$projectSlug/overview",
    });
  },
});
