import { createFileRoute } from '@tanstack/react-router';
import { Page } from '@/features/shell';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/developers/'
)({
  component: RouteComponent
});

function RouteComponent() {
  return (
    <Page>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">Developers</h1>
      </div>
    </Page>
  );
}
