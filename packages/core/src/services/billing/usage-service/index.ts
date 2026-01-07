import { Effect } from 'effect';
import { checkLimit } from './check-limit';
import { getUsage } from './get-usage';
import { getAllUsageSummaries, getUsageSummary } from './get-usage-summary';
import { recordUsage } from './record-usage';

export class UsageService extends Effect.Service<UsageService>()(
  'UsageService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        /**
         * Record a usage event for a metric
         * This is the main API for tracking usage throughout the codebase
         */
        recordUsage: yield* recordUsage,

        /**
         * Get current usage for a metric in the current billing period
         */
        getUsage: yield* getUsage,

        /**
         * Get usage summary with limit info (for UI)
         */
        getUsageSummary: yield* getUsageSummary,

        /**
         * Get all usage summaries for an organization
         */
        getAllUsageSummaries: yield* getAllUsageSummaries,

        /**
         * Check if approaching or over limit (returns warning or null)
         * Use this for warn-only enforcement
         */
        checkLimit: yield* checkLimit
      } as const;
    })
  }
) {}
