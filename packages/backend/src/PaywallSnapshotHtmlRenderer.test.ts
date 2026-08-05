import { SnapshotHtmlRenderer } from "@voidhash/core/services/paywallReleases/SnapshotHtmlRenderer";
import {
  createInitialPaywallDocumentInput,
  PaywallDesignerDocument,
} from "@voidhash/mimic-schema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { BackendSnapshotHtmlRendererLive } from "./PaywallSnapshotHtmlRenderer.ts";

describe("BackendSnapshotHtmlRendererLive", () => {
  it("renders a hydrated Mimic snapshot with release metadata", async () => {
    const snapshot = PaywallDesignerDocument.decode(
      PaywallDesignerDocument.encode(createInitialPaywallDocumentInput()),
    )?.[0];

    const html = await Effect.runPromise(
      Effect.gen(function* () {
        const renderer = yield* SnapshotHtmlRenderer;
        return yield* renderer.render({
          componentTrees: {},
          metadata: {
            createdAt: "2026-07-11T00:00:00.000Z",
            schemaVersion: 1,
            status: "draft",
            version: 3,
          },
          snapshot,
        });
      }).pipe(
        Effect.catch((error) => Effect.die(error.cause)),
        Effect.provide(BackendSnapshotHtmlRendererLive),
      ),
    );

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("VOIDHASH_PAYWALL_METADATA");
    expect(html).toContain('"version":3');
    expect(html).toContain("__VOIDHASH_PAYWALL__");
  });
});
