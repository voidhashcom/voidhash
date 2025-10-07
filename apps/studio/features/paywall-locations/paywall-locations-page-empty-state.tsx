'use client';

import type { Paywall } from '@voidhash/db';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@voidhash/ui';
import { useState } from 'react';
import { CreatePaywallLocationModal } from './create-paywall-location-modal';

export function PaywallLocationsPageEmptyState({
  projectId,
  paywalls
}: {
  projectId: string;
  paywalls: Paywall[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="mx-auto w-full max-w-5xl text-center">
      <CardHeader>
        <CardTitle>No paywall locations yet</CardTitle>
        <CardDescription className="mx-auto max-w-md text-balance">
          Paywall locations are places across your app where you show a paywall
          to the customer. This allows you to switch between paywalls without
          having to change the code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreatePaywallLocationModal
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
          open={open}
          paywalls={paywalls}
          projectId={projectId}
          trigger={
            <Button onClick={() => setOpen(true)}>
              Create paywall location
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
