'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@voidhash/ui';
import { useCurrentUser } from 'hooks/tanstack-query';
import { useParams } from 'next/navigation';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { listApiKeysOptions } from '@/lib/tanstack-query/api-keys';
import { CurrentUser } from '@/lib/utils/current-user';
import { ApiKeyRecord } from './api-key-record';
import { CreateSecretKeyModalButton } from './create-secret-key-modal-button';
import { ProjectApiKeysPageSkeleton } from './project-api-keys-page-skeleton';

export const ProjectApiKeysPage = () => {
  const { organizationSlug, projectSlug } = useParams();
  const { data: currentUser, status: currentUserStatus } = useCurrentUser();
  const project =
    currentUser &&
    CurrentUser.getProjectBySlugs(
      currentUser,
      organizationSlug as string,
      projectSlug as string
    );
  const { data: apiKeys, status: apiKeysStatus } = useQuery({
    ...listApiKeysOptions({ projectId: project?.id ?? '' }),
    enabled: !!project?.id
  });

  if (apiKeysStatus === 'pending' || currentUserStatus === 'pending') {
    return <ProjectApiKeysPageSkeleton />;
  }

  if (apiKeysStatus === 'error' || currentUserStatus === 'error' || !project) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the api keys'
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-row items-center justify-between pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">API Keys</h2>
          <p className="mt-1 text-muted-foreground">Manage your API keys</p>
        </div>
        <CreateSecretKeyModalButton projectId={project.id} />
      </div>

      <div className="mt-8">
        <Card className="grid gap-0 divide-y p-0">
          {apiKeys.map((apiKey) => (
            <ApiKeyRecord apiKey={apiKey} key={apiKey.id} />
          ))}
        </Card>
      </div>
    </div>
  );
};
