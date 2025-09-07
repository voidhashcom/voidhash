import { ProjectSettingsGeneralPage } from '@/features/projects/settings/general/project-settings-general-page';

export default async function GeneralSettingsPage({
  params
}: {
  params: Promise<{ organizationSlug: string; projectSlug: string }>;
}) {
  const { organizationSlug, projectSlug } = await params;

  return (
    <ProjectSettingsGeneralPage
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
    />
  );
}
