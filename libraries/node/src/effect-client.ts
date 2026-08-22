import { Effect } from "effect";

import type { VoidhashNodeClientOptions } from "./types";
import { makeAnalytics, type VoidhashAnalyticsEffectNamespace } from "./analytics";
import { makeEntitlements, type VoidhashEntitlementsEffectNamespace } from "./entitlements";
import { type FilterSdkGroup, filterSdkGroup } from "./internal/filter-sdk-group";
import {
  makeGeneratedClient,
  type GeneratedVoidhashNodeEffectClient,
} from "./internal/make-generated-client";

export type VoidhashNodeEffectClient = FilterSdkGroup<GeneratedVoidhashNodeEffectClient> & {
  readonly analytics: VoidhashAnalyticsEffectNamespace;
  readonly entitlements: VoidhashEntitlementsEffectNamespace;
};

export const createVoidhashSdk = (options: VoidhashNodeClientOptions): VoidhashNodeEffectClient => {
  const client = filterSdkGroup(Effect.runSync(makeGeneratedClient(options)));

  return {
    ...client,
    analytics: makeAnalytics(options),
    entitlements: makeEntitlements(client),
  };
};
