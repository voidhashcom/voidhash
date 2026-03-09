import { Effect } from "effect";

import type { VoidhashNodeClientOptions } from "./types";
import type { PublicVoidhashNodeEffectClient } from "./internal/client-types";
import {
  type FilterSdkGroup,
  filterSdkGroup,
} from "./internal/filter-sdk-group";
import { makeGeneratedClient } from "./internal/make-generated-client";
import { normalizeGeneratedClient } from "./internal/normalize-generated-client";

export type VoidhashNodeEffectClient =
  FilterSdkGroup<PublicVoidhashNodeEffectClient>;

export const createVoidhashNodeEffectClient = (
  options: VoidhashNodeClientOptions
): VoidhashNodeEffectClient =>
  filterSdkGroup(
    normalizeGeneratedClient(Effect.runSync(makeGeneratedClient(options)))
  ) as VoidhashNodeEffectClient;
