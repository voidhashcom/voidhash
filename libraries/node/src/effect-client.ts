import { Effect } from "effect";

import type { VoidhashNodeClientOptions } from "./types";
import { makeEntitlements, type VoidhashEntitlementsEffectNamespace } from "./entitlements";
import { makeEventCapture, type VoidhashEventCaptureEffectNamespace } from "./event-capture";
import { type FilterSdkGroup, filterSdkGroup } from "./internal/filter-sdk-group";
import {
  makeGeneratedClients,
  type GeneratedVoidhashNodeEffectClient,
} from "./internal/make-generated-client";

export type VoidhashNodeEffectClient = FilterSdkGroup<GeneratedVoidhashNodeEffectClient> & {
  readonly entitlements: VoidhashEntitlementsEffectNamespace;
  readonly eventCapture: VoidhashEventCaptureEffectNamespace;
};

/**
 * Builds the Effect-flavoured SDK. Throws `VoidhashNodeConfigurationError` when
 * the options are invalid.
 */
export const createVoidhashSdk = (options: VoidhashNodeClientOptions): VoidhashNodeEffectClient => {
  const generated = Effect.runSync(makeGeneratedClients(options));
  const client = filterSdkGroup(generated.core);

  return {
    ...client,
    entitlements: makeEntitlements(client),
    eventCapture: makeEventCapture(generated.eventCapture, options.publishableKey),
  };
};
