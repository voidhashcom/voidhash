"use client";

import { queryOptions, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Schema } from "effect";
import { PreviewTreeSchema } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { PreviewTree } from "@voidhash/paywall-renderer-web-core";

const decodePreviewTree = Schema.decodeUnknownSync(PreviewTreeSchema);

export interface ComponentPreviewTreeOptions {
  contentHash: string;
  state: string;
  /** Server-constructed `…/c/<contentHash>` base, no trailing slash. */
  artifactBaseUrl: string;
}

/**
 * Query factory for a component preview tree artifact
 * (`<artifactBaseUrl>/previews/<state>.json`). Artifacts are immutable per
 * contentHash, hence `staleTime: Infinity`. Fetch rejections and decode
 * failures surface as query errors — consumers render a placeholder for both
 * (the route cannot distinguish 404 from network failure).
 */
export const componentPreviewTreeOptions = (options: ComponentPreviewTreeOptions) =>
  queryOptions({
    queryFn: async (): Promise<PreviewTree> => {
      const response = await fetch(`${options.artifactBaseUrl}/previews/${options.state}.json`);
      if (!response.ok) {
        // oxlint-disable-next-line effect/noThrowStatement -- TanStack Query `queryFn` contract: a rejected promise IS the failure channel, and per the jsdoc above consumers render one placeholder for fetch and decode failures alike. A tagged error resolved as a value would be cached as success.
        throw new Error(
          `Failed to fetch preview tree ${options.contentHash}/${options.state}: ${response.status}`,
        );
      }
      return decodePreviewTree(await response.json());
    },
    queryKey: ["componentPreviewTree", options.contentHash, options.state],
    retry: 1,
    staleTime: Number.POSITIVE_INFINITY,
  });

/** Hook form of {@link componentPreviewTreeOptions}. */
export function useComponentPreviewTree(
  options: ComponentPreviewTreeOptions,
): UseQueryResult<PreviewTree> {
  return useQuery(componentPreviewTreeOptions(options));
}
