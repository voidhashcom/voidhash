import { PaywallsDetailPage } from '@/features/paywalls/paywalls-detail-page';

export default async function Page({
  params
}: {
  params: Promise<{
    organizationSlug: string;
    projectSlug: string;
    id: string;
  }>;
}) {
  const { organizationSlug, projectSlug, id } = await params;

  return (
    <PaywallsDetailPage
      id={id}
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
    />
  );
}
