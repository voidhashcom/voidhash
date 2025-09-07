import { DevelopersPage } from '@/features/developers/developers-page';

export default async function Page({
  params
}: {
  params: { organizationSlug: string; projectSlug: string };
}) {
  const { organizationSlug, projectSlug } = await params;
  return (
    <DevelopersPage
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
    />
  );
}
