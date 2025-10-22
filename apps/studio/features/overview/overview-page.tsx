'use client';
import { Page } from '@/features/shell';
import { TodayRevenueChart } from './today-revenue-chart';
import { ActiveSubsChartWidget } from './widgets/active-subs-chart-widget';
import { ActiveTrialsChartWidget } from './widgets/active-trials-chart-widget';
import { ARPPUChartWidget } from './widgets/arppu-chart-widget';
import { ARPUChartWidget } from './widgets/arpu-chart-widget';
import { ARRChartWidget } from './widgets/arr-chart-widget';
import { MRRChartWidget } from './widgets/mrr-chart-widget';
import { NewSubsChartWidget } from './widgets/new-subs-chart-widget';
import { NewTrialsChartWidget } from './widgets/new-trials-chart-widget';
import { NewUsersChartWidget } from './widgets/new-users-chart-widget';
import { RenewalCanceledSubsChartWidget } from './widgets/renewal-canceled-subs-chart-widget';
import { RevenueChartWidget } from './widgets/revenue-chart-widget';

export const OverviewPage = () => {
  // const { organizationSlug, projectSlug } = useParams();
  return (
    <Page>
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-row items-center justify-between">
          <h1 className="font-normal text-3xl tracking-right">Today</h1>
        </div>

        <div className="mt-8">
          <TodayRevenueChart />
        </div>

        <div className="mt-8 flex flex-row items-center justify-between">
          <h1 className="font-normal text-3xl tracking-right">Overview</h1>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4">
          <RevenueChartWidget />
          <MRRChartWidget />
          <ARRChartWidget />
          <ARPUChartWidget />
          <ARPPUChartWidget />
          <NewUsersChartWidget />
          <ActiveTrialsChartWidget />
          <NewTrialsChartWidget />
          <NewSubsChartWidget />
          <ActiveSubsChartWidget />
          <RenewalCanceledSubsChartWidget />
        </div>
      </div>
    </Page>
  );
};
