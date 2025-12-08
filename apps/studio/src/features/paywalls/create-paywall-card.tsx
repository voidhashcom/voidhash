'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CreatePaywallModal } from './create-paywall-modal';

interface CreatePaywallCardProps {
  projectId: string;
}

export function CreatePaywallCard({ projectId }: CreatePaywallCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <CreatePaywallModal
      onClose={() => setOpen(false)}
      onSuccess={() => setOpen(false)}
      open={open}
      projectId={projectId}
      trigger={
        <button
          className="group relative w-full cursor-pointer overflow-hidden rounded-xl border-2 border-muted-foreground/25 border-dashed bg-muted/30 transition-all hover:border-muted-foreground/50 hover:bg-muted/50"
          onClick={() => setOpen(true)}
          type="button"
        >
          {/* Height spacer - matches PaywallCard structure */}
          <div className="invisible">
            <div className="aspect-3/4" />
            <div className="p-4">
              <div className="h-5" />
              <div className="mt-0.5 h-5" />
            </div>
          </div>
          {/* Centered content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-muted-foreground/20">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <span className="mt-3 font-medium text-muted-foreground text-sm">
              Create Paywall
            </span>
          </div>
        </button>
      }
    />
  );
}
