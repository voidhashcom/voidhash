'use client';
import { SettingsCardSkeleton } from '@voidhash/ui';
import { useCurrentUser } from 'hooks/tanstack-query';
import { useParams } from 'next/navigation';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { SettingsGeneralLayout } from './settings-general-layout';
import { TeamDelete } from './team-delete';
import { TeamNameForm } from './team-name';

export function SettingsGeneralPage() {
  const { organizationSlug } = useParams();
  const { data: currentUser, status: currentUserStatus } = useCurrentUser();

  if (currentUserStatus === 'pending') {
    return (
      <SettingsGeneralLayout>
        <SettingsCardSkeleton content={true} />
        <SettingsCardSkeleton
          action={false}
          content={false}
          description={false}
          instructions={false}
        />
      </SettingsGeneralLayout>
    );
  }

  if (currentUserStatus === 'error') {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the organization'
        }}
      />
    );
  }

  if (currentUser) {
    const activeOrganization = currentUser.organizations.find(
      (organization) => organization.slug === organizationSlug
    );
    if (!activeOrganization) {
      return (
        <VoidhashErrorCard
          error={{
            code: 'NOT_FOUND',
            message: 'Organization not found'
          }}
        />
      );
    }
    return (
      <SettingsGeneralLayout>
        <TeamNameForm
          key={organizationSlug as string}
          organization={activeOrganization}
        />
        <TeamDelete organizationId={activeOrganization.id} />
      </SettingsGeneralLayout>
    );
  }
}
