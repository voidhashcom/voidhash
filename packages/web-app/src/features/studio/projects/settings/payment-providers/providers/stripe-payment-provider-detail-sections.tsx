"use client";

import { Input } from "@voidhash/ui";
import type { ReactNode } from "react";
import type { FieldErrors, FieldPath, UseFormReturn } from "react-hook-form";
import type { StripeGlobalConfiguration } from "@/features/studio/lib/payment-providers/stripe";
import { SettingsCard, SettingsRow } from "@/features/studio/settings";

import { PaymentProviderCopyableValue } from "../components/payment-provider-copyable-value";
import { PaymentProviderDetailSection } from "../components/payment-provider-detail-section";
import { PaymentProviderTextFieldRow } from "../components/payment-provider-form-fields";
import {
  STRIPE_FIELD_LABELS,
  type StripeTabId,
} from "./stripe-payment-provider-detail-config";

export function StripePaymentProviderTabContent({
  activeTab,
  errors,
  form,
  name,
  onNameChange,
  webhookEndpointUrl,
}: {
  activeTab: StripeTabId;
  errors: FieldErrors<StripeGlobalConfiguration>;
  form: UseFormReturn<StripeGlobalConfiguration>;
  name: string;
  onNameChange: (name: string) => void;
  webhookEndpointUrl: string;
}) {
  return (
    <>
      {activeTab === "account" ? (
        <PaymentProviderDetailSection
          description="Connect this provider to the Stripe account whose revenue data should be consolidated."
          title="Account"
        >
          <SettingsCard>
            <SettingsRow
              control={
                <Input
                  className="w-full sm:w-96"
                  onChange={(inputEvent) =>
                    onNameChange(inputEvent.target.value)
                  }
                  placeholder="Provider name"
                  value={name}
                />
              }
              title="Name"
            />
            <StripeTextFieldRow
              control={form.control}
              description="The account identifier from your Stripe Dashboard."
              errors={errors}
              name="accountId"
              placeholder="acct_123456789"
              title="Stripe account ID"
            />
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}

      {activeTab === "live-credentials" ? (
        <PaymentProviderDetailSection
          description="Use live-mode Stripe credentials for production revenue events."
          title="Live credentials"
        >
          <SettingsCard>
            <StripeTextFieldRow
              control={form.control}
              description="Use a live restricted key when possible. The value is encrypted before it is stored."
              errors={errors}
              name="live.secretKey"
              placeholder="rk_live_..."
              title="Live API key"
              type="password"
            />
            <StripeTextFieldRow
              control={form.control}
              description="The signing secret for the live-mode Stripe webhook endpoint."
              errors={errors}
              name="live.webhookSecret"
              placeholder="whsec_..."
              title="Live webhook signing secret"
              type="password"
            />
            <SettingsRow
              control={
                <PaymentProviderCopyableValue
                  copyLabel="Copy Stripe webhook endpoint URL"
                  copySuccessMessage="Stripe webhook endpoint URL copied"
                  value={webhookEndpointUrl}
                />
              }
              description="Add this URL as a webhook endpoint in your live-mode Stripe Dashboard, then paste the resulting signing secret above."
              title="Webhook endpoint URL"
            />
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}

      {activeTab === "test-credentials" ? (
        <PaymentProviderDetailSection
          description="Use test-mode Stripe credentials for sandbox revenue events."
          title="Test credentials"
        >
          <SettingsCard>
            <StripeTextFieldRow
              control={form.control}
              description="Use a test restricted key when possible. The value is encrypted before it is stored."
              errors={errors}
              name="test.secretKey"
              placeholder="rk_test_..."
              title="Test API key"
              type="password"
            />
            <StripeTextFieldRow
              control={form.control}
              description="The signing secret for the test-mode Stripe webhook endpoint."
              errors={errors}
              name="test.webhookSecret"
              placeholder="whsec_..."
              title="Test webhook signing secret"
              type="password"
            />
            <SettingsRow
              control={
                <PaymentProviderCopyableValue
                  copyLabel="Copy Stripe webhook endpoint URL"
                  copySuccessMessage="Stripe webhook endpoint URL copied"
                  value={webhookEndpointUrl}
                />
              }
              description="Add this URL as a webhook endpoint in your test-mode Stripe Dashboard, then paste the resulting signing secret above."
              title="Webhook endpoint URL"
            />
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}
    </>
  );
}

function StripeTextFieldRow({
  control,
  description,
  disabled,
  errors,
  name,
  optional,
  placeholder,
  title,
  type,
}: {
  control: UseFormReturn<StripeGlobalConfiguration>["control"];
  description?: ReactNode;
  disabled?: boolean;
  errors: FieldErrors<StripeGlobalConfiguration>;
  name: FieldPath<StripeGlobalConfiguration>;
  optional?: boolean;
  placeholder?: string;
  title: ReactNode;
  type?: "password" | "text" | "url";
}) {
  return (
    <PaymentProviderTextFieldRow
      control={control}
      description={description}
      disabled={disabled}
      errors={errors}
      fieldLabels={STRIPE_FIELD_LABELS}
      name={name}
      optional={optional}
      placeholder={placeholder}
      title={title}
      type={type}
    />
  );
}
