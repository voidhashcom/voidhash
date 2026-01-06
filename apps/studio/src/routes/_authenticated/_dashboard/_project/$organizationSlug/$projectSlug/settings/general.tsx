import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from 'src/components/auth-context';
import { ProjectDelete } from '@/features/projects/settings/general/project-delete';
import { ProjectNameForm } from '@/features/projects/settings/general/project-name';
import { ProjectSettingsGeneralLayout } from '@/features/projects/settings/general/project-settings-general-layout';
import { ProjectSettingsGeneralPageSkeleton } from '@/features/projects/settings/general/project-settings-general-page-skeleton';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { CurrentUser } from '@/lib/utils/current-user';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/general'
)({
  pendingComponent: ProjectSettingsGeneralPageSkeleton,
  errorComponent: ProjectSettingsGeneralPageError,
  component: ProjectSettingsGeneralPage
});

function ProjectSettingsGeneralPageError() {
  return (
    <VoidhashErrorCard
      error={{ code: 'NOT_FOUND', message: 'Project not found' }}
    />
  );
}

function ProjectSettingsGeneralPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();

  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string
  );

  if (!project) {
    throw new Error('Project not found');
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
