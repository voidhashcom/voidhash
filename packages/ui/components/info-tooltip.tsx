'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@voidhash/ui';
import { InfoIcon } from 'lucide-react';
import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

export function InfoTooltip({ info }: { info: string }) {
  const [showAppUserIdTooltip, setShowAppUserIdTooltip] = useState(false);
  const debouncedShowAppUserIdTooltip = useDebouncedCallback(
    // function
    (value: boolean) => {
      setShowAppUserIdTooltip(value);
    },
    // delay in ms
    40
  );
  return (
    <Tooltip open={showAppUserIdTooltip}>
      <TooltipTrigger
        onMouseEnter={() => debouncedShowAppUserIdTooltip(true)}
        onMouseLeave={() => debouncedShowAppUserIdTooltip(false)}
      >
        <div className="p-px">
          <InfoIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <p>{info}</p>
      </TooltipContent>
    </Tooltip>
  );
}
