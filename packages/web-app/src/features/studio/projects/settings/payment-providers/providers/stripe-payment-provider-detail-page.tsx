"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { PaymentProviderConfiguration } from "@voidhash/rpc";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Form,
} from "@voidhash/ui";
import { EllipsisVerticalIcon } from "lucide-react";
import { type BaseSyntheticEvent, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  stripe,
  type StripeGlobalConfiguration,
  stripeGlobalConfigurationSchema,
} from "@/features/studio/lib/payment-providers/stripe";
import { env } from "@/lib/env";

import { PaymentProviderDetailActionBar } from "../components/payment-provider-detail-action-bar";
import { PaymentProviderDetailFormLayout } from "../components/payment-provider-detail-form-layout";
import { PaymentProviderDetailPageChrome } from "../components/payment-provider-detail-page-chrome";
import type { PaymentProviderDetailTab } from "../components/payment-provider-detail-tab-nav";
import { getPaymentProviderTabValidationSummary } from "../components/payment-provider-validation";
import { StripeLogo } from "../logos/stripe-logo";
import { usePaymentProviderConfigurationMutations } from "../use-payment-provider-configuration-mutations";
import {
  getStripeInitialConfiguration,
  getStripeWebhookEndpointUrl,
  isStripeOptionalField,
  STRIPE_FIELD_LABELS,
  STRIPE_TABS,
  type StripeTabId,
} from "./stripe-payment-provider-detail-config";
import { StripePaymentProviderTabContent } from "./stripe-payment-provider-detail-sections";

export function StripePaymentProviderDetailPage({
  organizationSlug,
  paymentProviderConfiguration,
  projectSlug,
}: {
  organizationSlug: string;
  projectSlug: string;
  project: { id: string };
  paymentProviderConfiguration: typeof PaymentProviderConfiguration.Type;
}) {
  const [name, setName] = useState(paymentProviderConfiguration.name);
  const [activeTab, setActiveTab] = useState<StripeTabId>("account");
  const configuration =
    paymentProviderConfiguration.configuration as Partial<StripeGlobalConfiguration> | null;
  const webhookEndpointUrl = getStripeWebhookEndpointUrl({
    apiUrl: env.VITE_APP_API_URL,
    paymentProviderConfigurationId: paymentProviderConfiguration.id,
  });

  const form = useForm<StripeGlobalConfiguration>({
    defaultValues: getStripeInitialConfiguration(configuration),
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(stripeGlobalConfigurationSchema),
  });

  useEffect(() => {
    void form.trigger();
  }, [form.trigger]);

  const {
    ConfirmationDialog,
    deleteConfiguration,
    isDeleting,
    isSaving,
    openDialog,
    updateConfiguration,
  } = usePaymentProviderConfigurationMutations({
    organizationSlug,
    projectSlug,
    providerTitle: stripe.title,
  });

  const saveConfiguration = (configuration: StripeGlobalConfiguration, enabled: boolean) => {
    updateConfiguration({
      configuration,
      enabled,
      id: paymentProviderConfiguration.id,
      name,
    });
  };

  const handleSubmit = async (event?: BaseSyntheticEvent) => {
    event?.preventDefault();

    const isValid = await form.trigger();
    const isCurrentlyEnabled = paymentProviderConfiguration.isEnabled;

    if (!isValid && isCurrentlyEnabled) {
      const shouldContinue = await openDialog({
        description:
          "The current configuration is invalid. If you continue, the payment provider will be disabled. Do you want to proceed?",
        title: "Invalid Configuration",
      });

      if (!shouldContinue) {
        return;
      }

      saveConfiguration(form.getValues(), false);
      return;
    }

    if (!isValid) {
      return;
    }

    if (!isCurrentlyEnabled) {
      const shouldEnable = await openDialog({
        description: "Would you like to enable this payment provider?",
        title: "Enable Payment Provider",
      });

      saveConfiguration(form.getValues(), Boolean(shouldEnable));
      return;
    }

    saveConfiguration(form.getValues(), true);
  };

  const values = form.watch();
  const { dirtyFields, errors } = form.formState;

  const tabs: PaymentProviderDetailTab[] = STRIPE_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    ...getPaymentProviderTabValidationSummary<StripeGlobalConfiguration>({
      errors,
      fieldLabels: STRIPE_FIELD_LABELS,
      fields: tab.fields,
      isOptionalField: isStripeOptionalField,
      values,
    }),
  }));

  const unsavedChangesCount =
    Object.keys(dirtyFields).length + (name === paymentProviderConfiguration.name ? 0 : 1);

  return (
    <PaymentProviderDetailPageChrome
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="outline">
              <EllipsisVerticalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isDeleting}
              onClick={(dropdownEvent) => {
                dropdownEvent.preventDefault();
                void deleteConfiguration(paymentProviderConfiguration.id);
              }}
              variant="destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
      providerIcon={<StripeLogo className="size-3.5" />}
      providerName="Stripe"
    >
      <Form {...form}>
        <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
          <PaymentProviderDetailFormLayout
            activeTabId={activeTab}
            onTabChange={(tabId) => setActiveTab(tabId as StripeTabId)}
            tabs={tabs}
          >
            <StripePaymentProviderTabContent
              activeTab={activeTab}
              errors={errors}
              form={form}
              name={name}
              onNameChange={setName}
              webhookEndpointUrl={webhookEndpointUrl}
            />
          </PaymentProviderDetailFormLayout>

          <PaymentProviderDetailActionBar className="pl-4">
            <p className="min-w-[14rem] text-muted-foreground text-sm">
              {unsavedChangesCount === 0
                ? "No unsaved changes"
                : `${unsavedChangesCount} unsaved change${unsavedChangesCount === 1 ? "" : "s"}`}
            </p>
            <Button disabled={isSaving || unsavedChangesCount === 0} size="lg" type="submit">
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </PaymentProviderDetailActionBar>

          <ConfirmationDialog />
        </form>
      </Form>
    </PaymentProviderDetailPageChrome>
  );
}
