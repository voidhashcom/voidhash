"use client";

import { Input } from "@voidhash/ui";
import type { ReactNode } from "react";
import type { FieldErrors, FieldPath, UseFormReturn } from "react-hook-form";
import type { GooglePlayGlobalConfiguration } from "@/features/studio/lib/payment-providers/google-play";
import { SettingsCard, SettingsRow } from "@/features/studio/settings";

import { PaymentProviderDetailSection } from "../components/payment-provider-detail-section";
import { PaymentProviderTextFieldRow } from "../components/payment-provider-form-fields";
import { PaymentProviderTextFileField } from "../components/payment-provider-text-file-field";
import {
  getPaymentProviderFieldValidationStatus,
  PaymentProviderFieldValidationIndicator,
} from "../components/payment-provider-validation";
import {
  GOOGLE_PLAY_FIELD_LABELS,
  type GooglePlayTabId,
} from "./google-play-payment-provider-detail-config";

export function GooglePlayPaymentProviderTabContent({
  activeTab,
  errors,
  form,
  name,
  onNameChange,
  values,
}: {
  activeTab: GooglePlayTabId;
  errors: FieldErrors<GooglePlayGlobalConfiguration>;
  form: UseFormReturn<GooglePlayGlobalConfiguration>;
  name: string;
  onNameChange: (name: string) => void;
  values: GooglePlayGlobalConfiguration;
}) {
  return (
    <>
      {activeTab === "app-details" ? (
        <PaymentProviderDetailSection
          description="Connect this provider to the Android app record in Google Play Console."
          title="App details"
        >
          <SettingsCard>
            <SettingsRow
              control={
                <Input
                  className="w-full sm:w-96"
                  onChange={(inputEvent) => onNameChange(inputEvent.target.value)}
                  placeholder="Provider name"
                  value={name}
                />
              }
              title="Name"
            />
            <GooglePlayTextFieldRow
              control={form.control}
              description="This is the Android application ID from your app's Gradle configuration."
              errors={errors}
              name="packageName"
              placeholder="com.example.app"
              title="Google Play package name"
            />
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}

      {activeTab === "service-account" ? (
        <PaymentProviderDetailSection
          description="Upload the JSON key for a Google Cloud service account with access to the Android Publisher API."
          title="Service account credentials"
        >
          <SettingsCard>
            <SettingsRow
              description="Used by Voidhash to validate Google Play purchases server-side."
              title="Service account key file"
            >
              <PaymentProviderTextFileField
                accept=".json,application/json"
                control={form.control}
                maxSize={1024 * 1024}
                name="serviceAccountKey"
                successMessage="Service account key file was successfully attached"
                validationIndicator={getGooglePlayFieldValidationIndicator({
                  errors,
                  name: "serviceAccountKey",
                  value: values.serviceAccountKey,
                })}
              />
            </SettingsRow>
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}

      {activeTab === "real-time-developer-notifications" ? (
        <PaymentProviderDetailSection
          description="Forward raw Google Play real-time developer notifications to your backend when you need your own event copy."
          title="Google developer notifications"
        >
          <SettingsCard>
            <GooglePlayTextFieldRow
              control={form.control}
              description="Optional. Use this Pub/Sub topic name in Google Play Console when you manage RTDN delivery outside Voidhash."
              errors={errors}
              name="googleRealTimeDeveloperNotificationTopicName"
              optional
              placeholder="projects/example-project/topics/google-play-rtdn"
              title="Google Play RTDN topic name"
            />
            <GooglePlayTextFieldRow
              control={form.control}
              description="Optional. Voidhash can forward received raw Google Play notification payloads to your backend."
              errors={errors}
              name="googleRealTimeDeveloperNotificationForwardingUrl"
              optional
              placeholder="https://example.com/google-raw-events"
              title="Raw Google events forwarding URL"
              type="url"
            />
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}
    </>
  );
}

function GooglePlayTextFieldRow({
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
  control: UseFormReturn<GooglePlayGlobalConfiguration>["control"];
  description?: ReactNode;
  disabled?: boolean;
  errors: FieldErrors<GooglePlayGlobalConfiguration>;
  name: FieldPath<GooglePlayGlobalConfiguration>;
  optional?: boolean;
  placeholder?: string;
  title: ReactNode;
  type?: "text" | "url";
}) {
  return (
    <PaymentProviderTextFieldRow
      control={control}
      description={description}
      disabled={disabled}
      errors={errors}
      fieldLabels={GOOGLE_PLAY_FIELD_LABELS}
      name={name}
      optional={optional}
      placeholder={placeholder}
      title={title}
      type={type}
    />
  );
}

function getGooglePlayFieldValidationIndicator({
  disabled,
  errors,
  name,
  optional = false,
  value,
}: {
  disabled?: boolean;
  errors: FieldErrors<GooglePlayGlobalConfiguration>;
  name: FieldPath<GooglePlayGlobalConfiguration>;
  optional?: boolean;
  value: unknown;
}) {
  const status = getPaymentProviderFieldValidationStatus({
    disabled,
    errors,
    fieldLabels: GOOGLE_PLAY_FIELD_LABELS,
    name,
    optional,
    value,
  });

  return <PaymentProviderFieldValidationIndicator status={status} />;
}
