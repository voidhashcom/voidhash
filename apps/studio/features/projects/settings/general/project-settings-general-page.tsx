'use client';

import { Result } from '@effect-atom/atom-react';
import { useUser } from 'atom/user';
import { useParams } from 'next/navigation';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { ProjectDelete } from './project-delete';
import { ProjectNameForm } from './project-name';
import { ProjectSettingsGeneralLayout } from './project-settings-general-layout';
import { ProjectSettingsGeneralPageSkeleton } from './project-settings-general-page-skeleton';

export function ProjectSettingsGeneralPage() {
  const { projectSlug } = useParams();
  return useUser().pipe(
    Result.match({
      onInitial: () => <ProjectSettingsGeneralPageSkeleton />,
      onFailure: () => (
        <VoidhashErrorCard
          error={{
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occured loading the project'
          }}
        />
      ),
      onSuccess: ({ value: user }) => {
        const project = user.projects.find((p) => p.slug === projectSlug);
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
    })
  );
}
