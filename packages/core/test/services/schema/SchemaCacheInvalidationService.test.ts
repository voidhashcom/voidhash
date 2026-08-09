import { Effect, Exit, Layer } from "effect";

import {
  type ProjectSchemaCacheShape,
  ProjectSchemaCache,
} from "../../../src/services/schema/SchemaService.ts";
import { SchemaCacheInvalidationService } from "../../../src/services/schema/SchemaCacheInvalidationService.ts";
import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

/**
 * A tiny recording fake of the {@link ProjectSchemaCache} port. This is the
 * only seam the service touches (it is otherwise pure `Effect.gen`), so a
 * canned in-memory double is allowed at the port boundary. `invalidations`
 * records every `projectId` routed through `getByName(...).invalidate()`.
 */
const recordingCache = () => {
  const invalidations: string[] = [];
  const cache: ProjectSchemaCacheShape = {
    getByName: (projectId: string) => ({
      get: () => Effect.succeed(null),
      set: () => Effect.void,
      invalidate: () =>
        Effect.sync(() => {
          invalidations.push(projectId);
        }),
    }),
  };
  return { cache, invalidations };
};

/**
 * A cache fake whose `invalidate()` always fails with a defect — used to prove
 * the service forwards port failures rather than swallowing them.
 */
class CacheInvalidateBoom {
  readonly _tag = "CacheInvalidateBoom";
}

const failingCache = (): ProjectSchemaCacheShape => ({
  getByName: () => ({
    get: () => Effect.succeed(null),
    set: () => Effect.void,
    invalidate: () => Effect.die(new CacheInvalidateBoom()),
  }),
});

/** Build the service layer wired to a given cache port fake. */
const layerWith = (cache: ProjectSchemaCacheShape) =>
  SchemaCacheInvalidationService.layer.pipe(
    Layer.provide(Layer.succeed(ProjectSchemaCache, cache)),
  );

describe("SchemaCacheInvalidationService.invalidate", () => {
  it.effect(
    "routes the projectId through cache.getByName(projectId).invalidate() and returns void",
    () => {
      const { cache, invalidations } = recordingCache();

      return Effect.gen(function* () {
        const service = yield* SchemaCacheInvalidationService;
        const result = yield* service.invalidate("project-abc");

        expect(result).toBeUndefined();
        expect(invalidations).toEqual(["project-abc"]);
      }).pipe(Effect.provide(layerWith(cache)));
    },
  );

  it.effect("invalidates the exact projectId given (per-project DO routing)", () => {
    const { cache, invalidations } = recordingCache();

    return Effect.gen(function* () {
      const service = yield* SchemaCacheInvalidationService;
      yield* service.invalidate("project-one");
      yield* service.invalidate("project-two");
      yield* service.invalidate("project-one");

      expect(invalidations).toEqual(["project-one", "project-two", "project-one"]);
    }).pipe(Effect.provide(layerWith(cache)));
  });

  it.effect("propagates a failure from the cache port instead of swallowing it", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.gen(function* () {
          const service = yield* SchemaCacheInvalidationService;
          return yield* service.invalidate("project-boom");
        }).pipe(Effect.provide(layerWith(failingCache()))),
      );

      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );
});
