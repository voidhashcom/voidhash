import { Effect } from "effect";

import type { VoidhashNodeClientOptions } from "./types";
import { type FilterSdkGroup, filterSdkGroup } from "./internal/filter-sdk-group";
import {
  makeGeneratedClient,
  type GeneratedVoidhashNodeEffectClient,
} from "./internal/make-generated-client";

export type VoidhashNodeEffectClient = FilterSdkGroup<GeneratedVoidhashNodeEffectClient>;

export const createVoidhashSdk = (options: VoidhashNodeClientOptions): VoidhashNodeEffectClient =>
  filterSdkGroup(Effect.runSync(makeGeneratedClient(options)));
