import React from "react";

import { useVoidhash } from "./use-voidhash";

export const useAnalytics = () => {
  const { client } = useVoidhash();

  return React.useMemo(
    () => ({
      enabled: true,
      flushAnalytics: () => client.flushAnalytics(),
      page: (
        pageName?: string,
        properties?: Record<string, unknown>,
        options?: { eventId?: string; sessionId?: string; timestamp?: string },
      ) => client.page(pageName, properties, options),
      track: (
        eventName: string,
        properties?: Record<string, unknown>,
        options?: { eventId?: string; sessionId?: string; timestamp?: string },
      ) => client.track(eventName, properties, options),
    }),
    [client],
  );
};
