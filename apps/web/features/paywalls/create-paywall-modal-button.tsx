'use client';
import { Button } from '@voidhash/ui/button';
import { useState } from 'react';
import { CreatePaywallModal } from './create-paywall-modal';

export function CreatePaywallModalButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <CreatePaywallModal
      onClose={() => setOpen(false)}
      onSuccess={() => setOpen(false)}
      open={open}
      projectId={projectId}
      trigger={<Button onClick={() => setOpen(true)}>Add Paywall</Button>}
    />
  );
}
