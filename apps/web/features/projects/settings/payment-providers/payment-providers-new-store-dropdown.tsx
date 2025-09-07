'use client';
import type { Project } from '@voidhash/db';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@voidhash/ui';
import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { toast } from 'sonner';
import { createPaymentProviderConfigurationAction } from '@/lib/nextjs/server-actions';
import { paymentProviders } from '@/lib/payment-providers/payment-providers';

export function PaymentProvidersNewStoreDropdown({
  project,
  organizationSlug,
  projectSlug
}: {
  project: Project;
  organizationSlug: string;
  projectSlug: string;
}) {
  const router = useRouter();

  const { execute, isPending } = useAction(
    createPaymentProviderConfigurationAction,
    {
      onSuccess: (res) => {
        toast.success('Payment provider configuration created successfully');
        router.push(
          `/${organizationSlug}/${projectSlug}/settings/payment-providers/${res.data?.id}`
        );
      }
    }
  );

  const handleCreatePaymentProviderConfiguration = (providerId: string) => {
    execute({
      providerId,
      projectId: project.id
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <PlusIcon className="h-4 w-4" />
          Add New Store
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {paymentProviders
          .filter((p) => p.getType() === 'native')
          .map((p) => (
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              key={p.getId()}
              onClick={() => {
                handleCreatePaymentProviderConfiguration(p.getId());
              }}
            >
              {p.getTitle()}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
