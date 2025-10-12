'use client';
import type { Paywall } from '@voidhash/db';
import { Button } from '@voidhash/ui/button';
import { useState } from 'react';
import { CreatePaywallLocationModal } from './create-paywall-location-modal';

export function CreatePaywallLocationModalButton({
  projectId,
  paywalls
}: {
  projectId: string;
  paywalls: Paywall[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <CreatePaywallLocationModal
      onClose={() => setOpen(false)}
      onSuccess={() => setOpen(false)}
      open={open}
      paywalls={paywalls}
      projectId={projectId}
      trigger={
        <Button onClick={() => setOpen(true)}>Add Paywall Location</Button>
      }
    />
  );
}
