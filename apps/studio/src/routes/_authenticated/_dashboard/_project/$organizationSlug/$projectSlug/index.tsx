import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@voidhash/ui';
import { DesignRecord } from '@/features/designer/design-record';
import { Page } from '@/features/shell';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/'
)({
  component: ProjectIndexPage
});

function ProjectIndexPage() {
  const { organizationSlug, projectSlug } = Route.useParams();

  const designs = [
    {
      id: '1',
      name: 'Placeholdr'
    }
  ];

  return (
    <Page>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">Designer</h1>
        <div className="mt-8">
          {designs.length === 0 ? (
            <div>No designs yet</div>
          ) : (
            <Card className="grid gap-0 divide-y p-0">
              {designs.map((design) => (
                <DesignRecord
                  design={design}
                  key={design.id}
                  organizationSlug={organizationSlug as string}
                  projectSlug={projectSlug as string}
                />
              ))}
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}
