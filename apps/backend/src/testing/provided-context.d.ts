import type { BackendTestConnections } from "./BackendTestConnections.ts";

// Typed channel for the connection slice that the shared integration setup
// provides through vitest. Keeping the local declaration narrow prevents the
// Community backend test graph from importing the Cloud stack package.
declare module "vitest" {
  interface ProvidedContext {
    coreStackOutput: {
      readonly testConnections: BackendTestConnections | null;
    };
  }
}
