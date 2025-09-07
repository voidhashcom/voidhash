'use client';

import { Button } from '@voidhash/ui/button';
import { useState } from 'react';
import type { ApiKey } from '@/lib/core/api-keys/types';
import { CreateSecretKeyModal } from './create-secret-key-modal';
import { SecretKeyRevealModal } from './secret-key-reveal-modal';

export function CreateSecretKeyModalButton({
  projectId
}: {
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [secretKey, setSecretKey] = useState<ApiKey | null>(null);
  return (
    <>
      <CreateSecretKeyModal
        onClose={() => setOpen(false)}
        onSuccess={(apiKey) => {
          setOpen(false);
          setSecretKey(apiKey);
        }}
        open={open}
        projectId={projectId}
        trigger={
          <Button onClick={() => setOpen(true)}>Create secret key</Button>
        }
      />
      <SecretKeyRevealModal
        apiKey={secretKey}
        onClose={() => setSecretKey(null)}
        open={!!secretKey}
      />
    </>
  );
}
