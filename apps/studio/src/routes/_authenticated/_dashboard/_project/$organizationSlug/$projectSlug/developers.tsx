import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DevelopersTabBar } from '@/features/developers/developers-tab-bar';
import { Page } from '@/features/shell';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/developers'
)({
  component: DevelopersLayout
});

function DevelopersLayout() {
  const { organizationSlug, projectSlug } = Route.useParams();

  const tabs = [
    {
      label: 'Overview',
      path: `/${organizationSlug}/${projectSlug}/developers`
    },
    {
      label: 'API Keys',
      path: `/${organizationSlug}/${projectSlug}/developers/api-keys`
    },
    // {
    //   label: 'Paywall Locations',
    //   path: `/${organizationSlug}/${projectSlug}/developers/paywall-locations`
    // },
    {
      label: 'Perks',
      path: `/${organizationSlug}/${projectSlug}/developers/perks`
    },
    {
      label: 'Webhooks',
      path: `/${organizationSlug}/${projectSlug}/developers/webhooks`
    }
  ];

  return (
    <Page className="p-0 py-8 ">
      {/* Key is used to reload the default form data when the organization slug changes */}

      <div className="mx-auto flex max-w-4xl flex-row items-center justify-between">
        <h1 className="font-normal text-3xl tracking-right">Developers</h1>
      </div>
      {/* <p className="text-muted-foreground mt-3">
					List of products available to purchase.
				</p> */}

      <div className="mt-3">
        <DevelopersTabBar tabs={tabs} />
        <Outlet />
      </div>
    </Page>
  );
}
