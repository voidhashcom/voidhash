'use client';
import { Card } from '@voidhash/ui';
import { useCurrentUser } from 'hooks/tanstack-query';
import { useParams } from 'next/navigation';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { DesignRecord } from './design-record';

export const DesignerPage = () => {
  const { organizationSlug, projectSlug } = useParams();
  const { status: currentUserStatus } = useCurrentUser();
  if (currentUserStatus === 'pending') {
    return <div>Loading...</div>;
  }

  const designs = [
    {
      id: '1',
      name: 'Placeholdr'
    }
  ];

  if (currentUserStatus === 'error') {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the developers'
        }}
      />
    );
  }

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
