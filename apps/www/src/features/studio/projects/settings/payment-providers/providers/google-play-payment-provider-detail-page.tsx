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
  googlePlay,
  type GooglePlayGlobalConfiguration,
  googlePlayGlobalConfigurationSchema,
} from "@/features/studio/lib/payment-providers/google-play";

import { PaymentProviderDetailActionBar } from "../components/payment-provider-detail-action-bar";
import { PaymentProviderDetailFormLayout } from "../components/payment-provider-detail-form-layout";
import { PaymentProviderDetailPageChrome } from "../components/payment-provider-detail-page-chrome";
import type { PaymentProviderDetailTab } from "../components/payment-provider-detail-tab-nav";
import { getPaymentProviderTabValidationSummary } from "../components/payment-provider-validation";
import { GooglePlayLogo } from "../logos/google-play-logo";
import { usePaymentProviderConfigurationMutations } from "../use-payment-provider-configuration-mutations";
import {
  getGooglePlayInitialConfiguration,
  GOOGLE_PLAY_FIELD_LABELS,
  GOOGLE_PLAY_TABS,
  type GooglePlayTabId,
  isGooglePlayOptionalField,
} from "./google-play-payment-provider-detail-config";
import { GooglePlayPaymentProviderTabContent } from "./google-play-payment-provider-detail-sections";

export function GooglePlayPaymentProviderDetailPage({
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
  const [activeTab, setActiveTab] = useState<GooglePlayTabId>("app-details");
  const configuration = paymentProviderConfiguration.configuration as
    | Partial<GooglePlayGlobalConfiguration>
    | null;

  const form = useForm<GooglePlayGlobalConfiguration>({
    defaultValues: getGooglePlayInitialConfiguration(configuration),
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(googlePlayGlobalConfigurationSchema),
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
    providerTitle: googlePlay.title,
  });

  const saveConfiguration = (configuration: GooglePlayGlobalConfiguration, enabled: boolean) => {
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
    const isCurrentlyEnabled = paymentProviderConfiguration.enabled;

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

  const tabs: PaymentProviderDetailTab[] = GOOGLE_PLAY_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    ...getPaymentProviderTabValidationSummary<GooglePlayGlobalConfiguration>({
      errors,
      fieldLabels: GOOGLE_PLAY_FIELD_LABELS,
      fields: tab.fields,
      isOptionalField: isGooglePlayOptionalField,
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
      providerIcon={<GooglePlayLogo className="size-3.5" />}
      providerName="Google Play"
    >
      <Form {...form}>
        <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
          <PaymentProviderDetailFormLayout
            activeTabId={activeTab}
            onTabChange={(tabId) => setActiveTab(tabId as GooglePlayTabId)}
            tabs={tabs}
          >
            <GooglePlayPaymentProviderTabContent
              activeTab={activeTab}
              errors={errors}
              form={form}
              name={name}
              onNameChange={setName}
              values={values}
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
