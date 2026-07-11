import { useQuery } from "@tanstack/react-query";

import { env } from "@/lib/env";

const disabledCapabilities = {
  enterprise: { auditLogs: false, billing: false },
} as const;

const loadRuntimeCapabilities = async () => {
  try {
    const apiBaseUrl = env.VITE_APP_API_URL.replace(/\/+$/, "");
    const response = await fetch(`${apiBaseUrl}/api/runtime-capabilities`, {
      credentials: "include",
    });
    if (!response.ok) return disabledCapabilities;

    const body = (await response.json()) as {
      readonly enterprise?: {
        readonly auditLogs?: unknown;
        readonly billing?: unknown;
      };
    };
    return {
      enterprise: {
        auditLogs: body.enterprise?.auditLogs === true,
        billing: body.enterprise?.billing === true,
      },
    };
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
