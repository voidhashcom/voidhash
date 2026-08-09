import { Config, Effect, Path } from "effect";

import { createStudioViteConfig } from "./src/server/config";

/**
 * Vite config for Studio. The project to preview is chosen by the
 * `VOIDHASH_PROJECT_ROOT` env var, which `voidhash-cli studio` sets when it
 * launches Vite. When run standalone (`pnpm --filter @voidhash/studio dev`) it
 * falls back to the bundled React Native example so Studio can be developed in
 * isolation.
 */
const projectRoot = Effect.runSync(
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fallback = path.resolve(import.meta.dirname, "../../examples/react-native-example");
    return yield* Config.string("VOIDHASH_PROJECT_ROOT").pipe(Config.withDefault(fallback));
  }).pipe(Effect.provide(Path.layer), Effect.orDie),
);

export default createStudioViteConfig({
  projectRoot,
  studioRoot: import.meta.dirname,
});
