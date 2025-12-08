import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_authenticated/_designer/$organizationSlug/$projectSlug/design/$id'
)({
  component: RouteComponent
});

function RouteComponent() {
  return (
    <div>Hello "/$organizationSlug/$projectSlug/_designer/design/$id"!</div>
  );
}
