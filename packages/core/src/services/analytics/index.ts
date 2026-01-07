import { Effect } from 'effect';
import { getAnalytics } from './get-analytics';

export class AnalyticsService extends Effect.Service<AnalyticsService>()(
  'AnalyticsService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        getAnalytics: yield* getAnalytics
      } as const;
    })
  }
) {}

export type { AnalyticsDataPoint, AnalyticsFilters } from './data-access/types';
