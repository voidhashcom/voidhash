import { constant } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ProjectSchemaCache } from "./SchemaService.ts";

/**
 * `SchemaCacheInvalidationService` drops a project's cached `ProjectSchema`
 * whenever a schema-shaping write lands (perks, products, paywall locations,
 * product-perk links, payment-provider configs / products).
 *
 * Each project maps to exactly one `ProjectSchemaCacheDO` instance via
 * `namespace.getByName(projectId)`, so invalidation is a single direct
 * `.invalidate()` call — no pub/sub fan-out. The dropped entry is repopulated
 * lazily on the next read by `SchemaService.fetchOrAssemble` (cache miss →
 * reassemble from the DB → `set`).
 *
 * Domain services depend on this service (in place of the removed
 * `CoreEventBus` publisher) and call {@link invalidate} after a successful
 * write. It depends only on the {@link ProjectSchemaCache} port, so it stays
 * infra-pure and can be provided alongside the support services that already
 * carry `ProjectSchemaCache`.
 */
export class SchemaCacheInvalidationService extends Context.Service<SchemaCacheInvalidationService>()(
  "SchemaCacheInvalidationService",
  {
    make: Effect.gen(function* () {
      const cache = yield* ProjectSchemaCache;

      const invalidate = Effect.fn("schemaCache.invalidate")(function* (projectId: string) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* cache.getByName(projectId).invalidate();
      });

      return constant({ invalidate });
    }),
  },
) {
  static layer = Layer.effect(SchemaCacheInvalidationService)(SchemaCacheInvalidationService.make);
}
