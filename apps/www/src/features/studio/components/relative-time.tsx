"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@voidhash/ui";
import { formatDistance } from "date-fns";
import { useEffect, useState } from "react";

const RELATIVE_TIME_REFRESH_MS = 30_000;

const utcFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "long",
  timeZone: "UTC",
});

const formatUnixTimestamp = (date: Date) => Math.floor(date.getTime() / 1000).toString();

export function RelativeTime({ value }: { value: Date | string }) {
  const date = value instanceof Date ? value : new Date(value);
  const [now, setNow] = useState(() => Date.now());
  const [isMounted, setIsMounted] = useState(false);
  const [deviceTimeZone, setDeviceTimeZone] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setDeviceTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, RELATIVE_TIME_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const relativeLabel = formatDistance(date, now, {
    addSuffix: true,
  });
  const deviceFormatter = isMounted
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "long",
      })
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <time
            className="cursor-default text-muted-foreground text-sm underline decoration-dotted underline-offset-4"
            dateTime={date.toISOString()}
            suppressHydrationWarning
          >
            {relativeLabel}
          </time>
        </TooltipTrigger>
        <TooltipContent align="end" className="max-w-xs">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="font-medium text-foreground text-xs">
                Your device{deviceTimeZone ? ` (${deviceTimeZone})` : ""}
              </p>
              <p className="text-muted-foreground text-xs">
                {deviceFormatter ? deviceFormatter.format(date) : date.toISOString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground text-xs">UTC</p>
              <p className="text-muted-foreground text-xs">{utcFormatter.format(date)}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground text-xs">Unix timestamp</p>
              <p className="font-mono text-muted-foreground text-xs">{formatUnixTimestamp(date)}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
