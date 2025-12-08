'use client';

import { useParams } from 'next/navigation';
import { useAuth } from 'src/components/auth-context';
import { VoidhashErrorCard } from 'src/features/shell/components/voidhash-error-card';
import { ProjectDelete } from './project-delete';
import { ProjectNameForm } from './project-name';
import { ProjectSettingsGeneralLayout } from './project-settings-general-layout';

export function ProjectSettingsGeneralPage() {
  const { projectSlug } = useParams();
  const { user } = useAuth();

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
