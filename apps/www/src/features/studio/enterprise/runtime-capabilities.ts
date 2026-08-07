import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";

import { env } from "@/lib/env";

/** Enabled enterprise capability ids advertised by the host composition. */
export type EnterpriseCapabilities = Readonly<Record<string, boolean>>;

export interface RuntimeCapabilities {
  readonly enterprise: EnterpriseCapabilities;
}

const disabledCapabilities: RuntimeCapabilities = {
  enterprise: {},
};

const loadRuntimeCapabilities = (): Promise<RuntimeCapabilities> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const apiBaseUrl = env.VITE_APP_API_URL.replace(/\/+$/, "");
      const response = yield* Effect.tryPromise(() =>
        fetch(`${apiBaseUrl}/api/runtime-capabilities`, { credentials: "include" }),
      );
      if (!response.ok) return disabledCapabilities;

      const body = (yield* Effect.tryPromise(() => response.json())) as {
        readonly enterprise?: Readonly<Record<string, unknown>>;
      };
      const enterprise: Record<string, boolean> = {};
      for (const [capability, enabled] of Object.entries(body.enterprise ?? {})) {
        if (enabled === true) {
          enterprise[capability] = true;
        }
      }
      return { enterprise };
    }).pipe(Effect.catchCause(() => Effect.succeed(disabledCapabilities))),
  );

/** Reads the backend composition's UI capabilities once per browser session. */
export const useRuntimeCapabilities = () =>
  useQuery({
    queryFn: loadRuntimeCapabilities,
    queryKey: ["runtime-capabilities"],
    staleTime: Number.POSITIVE_INFINITY,
  });
