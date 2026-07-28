import { useQuery } from "@tanstack/react-query";

import { env } from "@/lib/env";

/** Enabled enterprise capability ids advertised by the host composition. */
export type EnterpriseCapabilities = Readonly<Record<string, boolean>>;

export interface RuntimeCapabilities {
  readonly enterprise: EnterpriseCapabilities;
}

const disabledCapabilities: RuntimeCapabilities = {
  enterprise: {},
};

const loadRuntimeCapabilities = async (): Promise<RuntimeCapabilities> => {
  try {
    const apiBaseUrl = env.VITE_APP_API_URL.replace(/\/+$/, "");
    const response = await fetch(`${apiBaseUrl}/api/runtime-capabilities`, {
      credentials: "include",
    });
    if (!response.ok) return disabledCapabilities;

    const body = (await response.json()) as {
      readonly enterprise?: Readonly<Record<string, unknown>>;
    };
    const enterprise: Record<string, boolean> = {};
    for (const [capability, enabled] of Object.entries(body.enterprise ?? {})) {
      if (enabled === true) {
        enterprise[capability] = true;
      }
    }
    return { enterprise };
  } catch {
    return disabledCapabilities;
  }
};

/** Reads the backend composition's UI capabilities once per browser session. */
export const useRuntimeCapabilities = () =>
  useQuery({
    queryFn: loadRuntimeCapabilities,
    queryKey: ["runtime-capabilities"],
    staleTime: Number.POSITIVE_INFINITY,
  });
