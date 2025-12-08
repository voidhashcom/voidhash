'use client';
import { Card } from '@voidhash/ui';
import { useParams } from 'next/navigation';
import { Page } from 'src/features/shell';
import { DesignRecord } from './design-record';

export const DesignerPage = () => {
  const { organizationSlug, projectSlug } = useParams();

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
            // <ProductsPageEmptyState projectId={project.id} />
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
};
