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
import { CreatePerkModal } from './create-perk-modal';

export function PerksPageEmptyState({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="mx-auto w-full max-w-5xl text-center">
      <CardHeader>
        <CardTitle>No perks yet</CardTitle>
        <CardDescription className="mx-auto max-w-md text-balance">
          Each product may unlock one or more perks for the customer, which your
          app uses to grant access to various features. Examples of perks
          include &quot;Full-Access&quot;, &quot;AI-features&quot;, and
          &quot;Premium-recipes&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreatePerkModal
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
          open={open}
          projectId={projectId}
          trigger={<Button onClick={() => setOpen(true)}>Create perk</Button>}
        />
      </CardContent>
    </Card>
  );
}
