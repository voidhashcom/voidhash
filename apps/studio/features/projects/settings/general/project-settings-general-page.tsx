'use client';

import { useCurrentUser } from 'hooks/tanstack-query';
import { useParams } from 'next/navigation';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { ProjectDelete } from './project-delete';
import { ProjectNameForm } from './project-name';
import { ProjectSettingsGeneralLayout } from './project-settings-general-layout';
import { ProjectSettingsGeneralPageSkeleton } from './project-settings-general-page-skeleton';

export function ProjectSettingsGeneralPage() {
  const { projectSlug } = useParams();
  const { data: currentUser, status: currentUserStatus } = useCurrentUser();

  if (currentUserStatus === 'pending') {
    return <ProjectSettingsGeneralPageSkeleton />;
  }

  if (currentUserStatus === 'error') {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the project'
        }}
      />
    );
  }

  if (currentUser) {
    const project = currentUser.projects.find((p) => p.slug === projectSlug);
    if (!project) {
      return (
        <VoidhashErrorCard
          error={{ code: 'NOT_FOUND', message: 'Project not found' }}
        />
      );
    }
    return (
      <ProjectSettingsGeneralLayout>
        <ProjectNameForm
          key={projectSlug as string}
          projectId={project.id}
          projectName={project.name}
        />
        <ProjectDelete projectId={project.id} />
      </ProjectSettingsGeneralLayout>
    );
  }
}
