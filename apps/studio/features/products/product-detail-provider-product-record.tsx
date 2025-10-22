'use client';

import { useMutation } from '@tanstack/react-query';
import type { PaymentProviderProduct } from '@voidhash/rpc';
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useConfirmDialog
} from '@voidhash/ui';
import { format } from 'date-fns';
import { Clock4Icon, EllipsisVerticalIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { paymentProviders } from '@/lib/payment-providers/payment-providers';
import {
  deletePaymentProviderProductOptions,
  setActivePaymentProviderProductOptions
} from '@/lib/tanstack-query';
import { ProviderProductSheet } from './provider-product-sheet';

export function ProductDetailProviderProductRecord({
  paymentProviderId,
  paymentProviderConfigurationId,
  providerProduct
}: {
  paymentProviderId: string;
  paymentProviderConfigurationId: string;
  providerProduct: typeof PaymentProviderProduct.Type;
}) {
  const router = useRouter();
  const paymentProvider = paymentProviders.find(
    (p) => p.id === paymentProviderId
  );

  const [openEditSheet, setOpenEditSheet] = useState(false);

  const { mutate: deleteProviderProduct, status: deleteProviderProductStatus } =
    useMutation({
      ...deletePaymentProviderProductOptions(),
      onSuccess: () => {
        toast.success(`${paymentProvider?.title} product successfully deleted`);
        router.refresh();
      },
      onError: () => {
        toast.error(`Failed to delete ${paymentProvider?.title} product`);
      }
    });

  const {
    mutate: setActiveProviderProduct,
    status: setActiveProviderProductStatus
  } = useMutation({
    ...setActivePaymentProviderProductOptions(),
    onSuccess: () => {
      toast.success(`${paymentProvider?.title} product successfully activated`);
      router.refresh();
    },
    onError: () => {
      toast.error(`Failed to activate ${paymentProvider?.title} product`);
    }
  });

  const handleSetActiveProviderProduct = () => {
    setActiveProviderProduct({
      productId: providerProduct.productId,
      paymentProviderConfigurationId,
      providerProductKey: providerProduct.providerProductKey
    });
  };

  const isPending = deleteProviderProductStatus === 'pending';
  const isSettingActiveProviderProduct =
    setActiveProviderProductStatus === 'pending';

  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const handleDeleteProviderProduct = async () => {
    if (!paymentProvider) {
      return;
    }

    const res = await openDialog({
      title: 'Delete product',
      description: `Are you sure you want to delete this ${paymentProvider.title} product? This may break access for customers who have already purchased this.`
    });

    if (!res) {
      return;
    }

    deleteProviderProduct({
      productId: providerProduct.productId,
      paymentProviderConfigurationId,
      providerProductKey: providerProduct.providerProductKey
    });
  };

  if (!paymentProvider) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between px-6 py-4 hover:bg-accent/30"
      key={providerProduct.providerProductKey}
    >
      <div
        className={cn(
          'flex flex-row gap-2',
          !providerProduct.isActive && 'opacity-50'
        )}
      >
        {paymentProvider.productConfigurationKeyProperties.map((key) => (
          <Badge key={key} variant="outline">
            {providerProduct.configuration?.[key]}
          </Badge>
        ))}
      </div>
      <div className="flex flex-row gap-2">
        <div className="flex flex-row items-center gap-4 text-muted-foreground">
          {providerProduct.isActive && (
            <div>
              <Badge variant="outline">Active</Badge>
            </div>
          )}
          <div
            className={cn(
              'flex flex-row items-center gap-1',
              !providerProduct.isActive && 'opacity-50'
            )}
          >
            <Clock4Icon className="h-4 w-4" />
            <span className="text-muted-foreground text-sm">
              {format(providerProduct.createdAt ?? new Date(), 'MMM d, yyyy')}
            </span>
          </div>
          <div />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="z-20" size="icon" variant="outline">
              <EllipsisVerticalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setOpenEditSheet(true)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isSettingActiveProviderProduct}
              onSelect={handleSetActiveProviderProduct}
            >
              {isSettingActiveProviderProduct ? 'Activating...' : 'Activate'}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isPending}
              onSelect={handleDeleteProviderProduct}
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConfirmationDialog />
      <ProviderProductSheet
        configuration={providerProduct.configuration}
        mode={'edit'}
        onClose={() => setOpenEditSheet(false)}
        open={openEditSheet}
        paymentProviderConfigurationId={paymentProviderConfigurationId}
        paymentProviderConfigurationProductId={providerProduct.id}
        productId={providerProduct.productId}
        providerId={paymentProviderId}
      />
    </div>
  );
}
