import type { PreviewTree } from "@voidhash/paywall-renderer-web-core";

/**
 * Preview-tree artifacts for the component nodes of a snapshot. Deployed
 * (`componentSource: "catalog"`) nodes resolve from `trees`, keyed by their
 * pinned `contentHash` then preview state. In-document code components
 * (`componentSource: "local"`) carry a sentinel `contentHash: ""`, so they
 * resolve from `localTrees` keyed by `componentPath` instead — this lets
 * the studio's preview show not-yet-deployed components compiled in-browser.
 * Component nodes without a matching tree render as labeled placeholders.
 */
export interface ComponentArtifacts {
  readonly trees: Record<string, Record<string, PreviewTree>>;
  /**
   * Preview trees for local (in-document) code components, keyed by the
   * instance's document-relative `componentPath` then preview state. Absent for
   * deployed/served paywalls, which contain only catalog components.
   */
  readonly localTrees?: Record<string, Record<string, PreviewTree>>;
}
