'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Skeleton
} from '@voidhash/ui';
import { toast } from 'sonner';
import {
  cancelSubscriptionOptions,
  createCheckoutSessionOptions,
  queryKeys
} from 'src/lib/tanstack-query';
import { UpgradeDialog } from './upgrade-dialog';
import { useState } from 'react';

interface BillingInfo {
  tier: 'free' | 'pro' | 'enterprise';
  subscriptionStatus: 'none' | 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}

interface SubscriptionCardProps {
  organizationId: string;
  billingInfo?: BillingInfo;
  isLoading: boolean;
}

const tierLabels: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise'
};

const defaultStatusInfo = {
  label: 'No subscription',
  variant: 'secondary' as const
};

const statusLabels = {
  none: defaultStatusInfo,
  active: { label: 'Active', variant: 'default' as const },
  canceled: { label: 'Canceled', variant: 'destructive' as const },
  past_due: { label: 'Past due', variant: 'destructive' as const },
  trialing: { label: 'Trial', variant: 'outline' as const }
};

export function SubscriptionCard({
  organizationId,
  billingInfo,
  isLoading
}: SubscriptionCardProps) {
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate: createCheckout, status: checkoutStatus } = useMutation({
    ...createCheckoutSessionOptions(),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast.error('Failed to create checkout session');
    }
  });

  const { mutate: cancelSubscription, status: cancelStatus } = useMutation({
    ...cancelSubscriptionOptions(),
    onSuccess: () => {
      toast.success('Subscription canceled');
      queryClient.invalidateQueries({
        queryKey: queryKeys.billing.getOrganizationBilling(organizationId)
      });
    },
    onError: () => {
      toast.error('Failed to cancel subscription');
    }
  });

  const handleUpgrade = (tier: 'pro' | 'enterprise') => {
    createCheckout({
      organizationId,
      tier,
      successUrl: `${window.location.origin}${window.location.pathname}?upgrade=success`,
      cancelUrl: window.location.href
    });
    setUpgradeDialogOpen(false);
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel your subscription?')) {
      cancelSubscription({ organizationId });
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const tier = billingInfo?.tier ?? 'free';
  const status = billingInfo?.subscriptionStatus ?? 'none';
  const statusInfo =
    statusLabels[status as keyof typeof statusLabels] ?? defaultStatusInfo;
  const canUpgrade = tier === 'free' || tier === 'pro';
  const canCancel = status === 'active' && tier !== 'free';

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Current Plan
            <Badge variant="outline" className="text-sm font-medium">
              {tierLabels[tier]}
            </Badge>
          </CardTitle>
          <CardDescription>
            Manage your subscription and billing details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          {billingInfo?.currentPeriodStart && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Billing period</span>
              <span>
                {formatDate(billingInfo.currentPeriodStart)} -{' '}
                {formatDate(billingInfo.currentPeriodEnd)}
              </span>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-border border-t bg-background py-3">
          {canCancel && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={cancelStatus === 'pending'}
            >
              {cancelStatus === 'pending'
                ? 'Canceling...'
                : 'Cancel Subscription'}
            </Button>
          )}
          {canUpgrade && (
            <Button
              onClick={() => setUpgradeDialogOpen(true)}
              disabled={checkoutStatus === 'pending'}
            >
              {checkoutStatus === 'pending' ? 'Loading...' : 'Upgrade Plan'}
            </Button>
          )}
        </CardFooter>
      </Card>

      <UpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        currentTier={tier}
        onUpgrade={handleUpgrade}
        isLoading={checkoutStatus === 'pending'}
      />
    </>
  );
}
