'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@voidhash/ui';
import { useState } from 'react';
import { CreatePaywallModal } from './create-paywall-modal';

export function PaywallsPageEmptyState({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="mx-auto w-full max-w-5xl text-center">
      <CardHeader>
        <CardTitle>No paywalls yet</CardTitle>
        <CardDescription className="mx-auto max-w-md text-balance">
          Paywalls are screens displayed to your customers. Each paywall can
          have a different set of products, offers, and additional
          configurations that enable you to optimize your checkout experience
          remotely.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreatePaywallModal
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
          open={open}
          projectId={projectId}
          trigger={
            <Button onClick={() => setOpen(true)}>Create paywall</Button>
          }
        />
      </CardContent>
    </Card>
  );
}
