import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/'
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$organizationSlug/$projectSlug/paywalls',
      params: {
        organizationSlug: params.organizationSlug,
        projectSlug: params.projectSlug
      }
    });
  }
});
