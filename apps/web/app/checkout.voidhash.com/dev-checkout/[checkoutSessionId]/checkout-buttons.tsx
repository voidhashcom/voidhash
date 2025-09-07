'use client';

import { Button } from '@voidhash/ui';
import { useAction } from 'next-safe-action/hooks';
import { toast } from 'sonner';
import {
  cancelDevCheckoutPurchaseAction,
  confirmDevCheckoutPurchaseAction
} from '@/lib/nextjs/server-actions';

export function CheckoutButtons({
  checkoutSessionId
}: {
  checkoutSessionId: string;
}) {
  const { execute: handleConfirm, isExecuting: isConfirming } = useAction(
    confirmDevCheckoutPurchaseAction,
    {
      onSuccess: (data) => {
        window.location.replace(
          `${data?.data ?? ''}?checkoutSessionId=${checkoutSessionId}&success=true`
        );
      },
      onError: (error) => {
        toast.error(error.error.serverError ?? 'An error occurred');
      }
    }
  );

  const { execute: handleCancel, isExecuting: isCancelling } = useAction(
    cancelDevCheckoutPurchaseAction,
    {
      onSuccess: (data) => {
        window.location.replace(
          `${data?.data ?? ''}?checkoutSessionId=${checkoutSessionId}&error=cancelled`
        );
      },
      onError: (error) => {
        toast.error(error.error.serverError ?? 'An error occurred');
      }
    }
  );

  return (
    <>
      <Button
        className="w-full"
        disabled={isConfirming}
        onClick={() => handleConfirm({ checkoutSessionId })}
      >
        {isConfirming ? 'Confirming...' : 'Confirm Purchase'}
      </Button>

      <Button
        className="w-full"
        disabled={isCancelling}
        onClick={() => handleCancel({ checkoutSessionId })}
        variant="outline"
      >
        {isCancelling ? 'Cancelling...' : 'Cancel'}
      </Button>
    </>
  );
}
