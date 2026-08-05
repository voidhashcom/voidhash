import type { CoreStackOutput } from "./CoreTestConnections.ts";

// Typed channel for the once-per-run environment output that a composition's
// `globalSetup` shares with every integration test file via vitest's
// `provide` / `inject`. Kept deliberately narrow: downstream compositions may
// provide richer objects, but the open-core suite depends only on this shape.
declare module "vitest" {
  interface ProvidedContext {
    coreStackOutput: CoreStackOutput;
  }
}
