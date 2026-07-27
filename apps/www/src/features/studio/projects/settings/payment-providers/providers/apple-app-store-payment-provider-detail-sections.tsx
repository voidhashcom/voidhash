"use client";

import { FormControl, FormField, FormItem, Input, Switch } from "@voidhash/ui";
import type { ReactNode } from "react";
import type { FieldErrors, FieldPath, UseFormReturn } from "react-hook-form";
import { WhereToFindGuide } from "@/features/docs/components/where-to-find-guide";
import type { AppleAppStoreGlobalConfiguration } from "@/features/studio/lib/payment-providers/app-store";
import { SettingsCard, SettingsRow } from "@/features/studio/settings";

import { PaymentProviderCopyableValue } from "../components/payment-provider-copyable-value";
import { PaymentProviderDetailSection } from "../components/payment-provider-detail-section";
import {
  PaymentProviderDateFieldRow,
  PaymentProviderSwitchRow,
  PaymentProviderTextFieldRow,
} from "../components/payment-provider-form-fields";
import { PaymentProviderTextFileField } from "../components/payment-provider-text-file-field";
import {
  getPaymentProviderFieldValidationStatus,
  PaymentProviderFieldValidationIndicator,
} from "../components/payment-provider-validation";
import { P8PrivateKeyField } from "../components/p8-private-key-field";
import {
  type AppStoreTabId,
  APPLE_APP_STORE_FIELD_GUIDES,
  APPLE_APP_STORE_FIELD_LABELS,
} from "./apple-app-store-payment-provider-detail-config";

export function AppleAppStorePaymentProviderTabContent({
  activeTab,
  appleServerToServerNotificationUrl,
  errors,
  form,
  hasSmallBusinessProgramEndDate,
  name,
  onNameChange,
  values,
}: {
  activeTab: AppStoreTabId;
  appleServerToServerNotificationUrl: string;
  errors: FieldErrors<AppleAppStoreGlobalConfiguration>;
  form: UseFormReturn<AppleAppStoreGlobalConfiguration>;
  hasSmallBusinessProgramEndDate: boolean;
  name: string;
  onNameChange: (name: string) => void;
  values: AppleAppStoreGlobalConfiguration;
}) {
  return (
    <>
      {activeTab === "app-details" ? (
        <PaymentProviderDetailSection
          description="Connect this provider to the app record in App Store Connect."
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
            <AppleTextFieldRow
              control={form.control}
              description="This should match the identifier configured in your Xcode project."
              errors={errors}
              name="bundleId"
              placeholder="com.example.app"
              title="App Bundle ID"
            />
            <AppleTextFieldRow
              control={form.control}
              description="The numeric Apple app identifier from App Store Connect."
              errors={errors}
              name="appAppleId"
              placeholder="1234567890"
              title="App Apple ID"
            />
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}

      {activeTab === "in-app-purchase-key" ? (
        <PaymentProviderDetailSection
          description="Required for StoreKit 2 transaction ingestion and accurate country-specific pricing."
          title="In-app purchase key configuration"
        >
          <SettingsCard>
            <AppleTextFieldRow
              control={form.control}
              errors={errors}
              name="inAppPurchaseKeyIssuerId"
              placeholder="00000000-0000-0000-0000-000000000000"
              title="Issuer ID"
            />
            <AppleTextFieldRow
              control={form.control}
              errors={errors}
              name="inAppPurchaseKeyId"
              placeholder="XXXXXXXXXX"
              title="Key ID"
            />
            <SettingsRow
              description="Upload the .p8 private key from App Store Connect that belongs to the key above."
              status={
                APPLE_APP_STORE_FIELD_GUIDES.inAppPurchasePrivateKey ? (
                  <WhereToFindGuide
                    fieldLabel="P8 key file"
                    guide={APPLE_APP_STORE_FIELD_GUIDES.inAppPurchasePrivateKey}
                  />
                ) : undefined
              }
              title="P8 key file"
            >
              <P8PrivateKeyField
                control={form.control}
                name="inAppPurchasePrivateKey"
                validationIndicator={getAppleFieldValidationIndicator({
                  errors,
                  name: "inAppPurchasePrivateKey",
                  value: values.inAppPurchasePrivateKey,
                })}
              />
            </SettingsRow>
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}

      {activeTab === "app-store-connect-api" ? (
        <PaymentProviderDetailSection
          description="Add an App Store Connect API key so Voidhash can import products and keep product metadata in sync."
          title="App Store Connect API"
        >
          <SettingsCard>
            <AppleTextFieldRow
              control={form.control}
              errors={errors}
              name="appStoreConnectApiIssuerId"
              placeholder="00000000-0000-0000-0000-000000000000"
              title="Issuer ID"
            />
            <AppleTextFieldRow
              control={form.control}
              errors={errors}
              name="appStoreConnectApiKeyId"
              placeholder="XXXXXXXXXX"
              title="Key ID"
            />
            <AppleTextFieldRow
              control={form.control}
              description="Find this on the Payments and Financial Reports page in App Store Connect."
              errors={errors}
              name="appStoreConnectApiVendorNumber"
              placeholder="12345678"
              title="Vendor Number"
            />
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}

      {activeTab === "apple-server-notification" ? (
        <PaymentProviderDetailSection
          description="Send Apple server notifications to Voidhash to process renewals, cancellations, refunds, and other subscription changes."
          title="Apple Server Notifications"
        >
          <SettingsCard>
            <SettingsRow
              control={
                <PaymentProviderCopyableValue
                  copyLabel="Copy Apple Server Notification URL"
                  copySuccessMessage="Apple Server Notification URL copied"
                  value={appleServerToServerNotificationUrl}
                />
              }
              title="Apple Server Notification URL"
            />
            <AppleTextFieldRow
              control={form.control}
              description="Optional. Voidhash can forward received Apple notification payloads to your backend."
              errors={errors}
              name="appleServerNotificationForwardingUrl"
              optional
              placeholder="https://example.com/apple-server-notifications"
              title="Apple Server Notification Forwarding URL"
              type="url"
            />
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}

      {activeTab === "apple-small-business-program" ? (
        <PaymentProviderDetailSection
          description="Use these dates to apply the Apple Small Business Program commission rate."
          title="Apple Small Business Program"
        >
          <SettingsCard>
            <AppleDateFieldRow
              control={form.control}
              errors={errors}
              name="appleSmallBusinessProgramStartDate"
              optional
              showValidationIndicator={false}
              title="Start date"
            />
            <AppleDateFieldRow
              control={form.control}
              description="Enable this if the reduced commission rate has ended or is scheduled to end."
              disabled={!hasSmallBusinessProgramEndDate}
              errors={errors}
              name="appleSmallBusinessProgramEndDate"
              optional={!hasSmallBusinessProgramEndDate}
              prefix={
                <FormField
                  control={form.control}
                  name="appleSmallBusinessProgramHasEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              form.setValue("appleSmallBusinessProgramEndDate", "", {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              }
              showValidationIndicator={false}
              title="End date"
            />
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}

      {activeTab === "development" ? (
        <PaymentProviderDetailSection
          description="Optional StoreKit assets for local Xcode testing and CI purchase flows."
          title="Development"
        >
          <SettingsCard>
            <SettingsRow
              description="Use the subscription offer signing key exported from Xcode when testing offers with a StoreKit configuration file."
              status={
                APPLE_APP_STORE_FIELD_GUIDES.storeKitSubscriptionOfferKey ? (
                  <WhereToFindGuide
                    fieldLabel="StoreKit Subscription Offer key"
                    guide={APPLE_APP_STORE_FIELD_GUIDES.storeKitSubscriptionOfferKey}
                  />
                ) : undefined
              }
              title="StoreKit Subscription Offer key"
            >
              <P8PrivateKeyField
                control={form.control}
                name="storeKitSubscriptionOfferKey"
                successMessage="StoreKit subscription offer key was successfully attached"
                validationIndicator={getAppleFieldValidationIndicator({
                  errors,
                  name: "storeKitSubscriptionOfferKey",
                  optional: true,
                  value: values.storeKitSubscriptionOfferKey,
                })}
              />
            </SettingsRow>
            <SettingsRow
              description="Upload the public certificate used by StoreKit tests in Xcode."
              status={
                APPLE_APP_STORE_FIELD_GUIDES.storeKitTestingFrameworkCertificate ? (
                  <WhereToFindGuide
                    fieldLabel="StoreKit testing framework"
                    guide={APPLE_APP_STORE_FIELD_GUIDES.storeKitTestingFrameworkCertificate}
                  />
                ) : undefined
              }
              title="StoreKit testing framework"
            >
              <PaymentProviderTextFileField
                accept=".cer"
                control={form.control}
                maxSize={1024 * 1024}
                name="storeKitTestingFrameworkCertificate"
                successMessage="StoreKit testing certificate was successfully attached"
                validationIndicator={getAppleFieldValidationIndicator({
                  errors,
                  name: "storeKitTestingFrameworkCertificate",
                  optional: true,
                  value: values.storeKitTestingFrameworkCertificate,
                })}
              />
            </SettingsRow>
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}

      {activeTab === "voidhash" ? (
        <PaymentProviderDetailSection
          description="Choose which Apple purchases Voidhash should create from server notifications."
          title="Purchase tracking"
        >
          <SettingsCard>
            <PaymentProviderSwitchRow
              control={form.control}
              description="This only takes effect after Apple Server Notifications are configured in App Store Connect."
              name="trackNewPurchasesFromAppleServerNotifications"
              title="Track purchases from Apple Server Notifications"
            />
          </SettingsCard>
        </PaymentProviderDetailSection>
      ) : null}
    </>
  );
}

function AppleTextFieldRow({
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
  control: UseFormReturn<AppleAppStoreGlobalConfiguration>["control"];
  description?: ReactNode;
  disabled?: boolean;
  errors: FieldErrors<AppleAppStoreGlobalConfiguration>;
  name: FieldPath<AppleAppStoreGlobalConfiguration>;
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
      fieldLabels={APPLE_APP_STORE_FIELD_LABELS}
      guide={APPLE_APP_STORE_FIELD_GUIDES[name]}
      name={name}
      optional={optional}
      placeholder={placeholder}
      title={title}
      type={type}
    />
  );
}

function AppleDateFieldRow({
  control,
  description,
  disabled,
  errors,
  name,
  optional,
  prefix,
  showValidationIndicator,
  title,
}: {
  control: UseFormReturn<AppleAppStoreGlobalConfiguration>["control"];
  description?: ReactNode;
  disabled?: boolean;
  errors: FieldErrors<AppleAppStoreGlobalConfiguration>;
  name: FieldPath<AppleAppStoreGlobalConfiguration>;
  optional?: boolean;
  prefix?: ReactNode;
  showValidationIndicator?: boolean;
  title: ReactNode;
}) {
  return (
    <PaymentProviderDateFieldRow
      control={control}
      description={description}
      disabled={disabled}
      errors={errors}
      fieldLabels={APPLE_APP_STORE_FIELD_LABELS}
      guide={APPLE_APP_STORE_FIELD_GUIDES[name]}
      name={name}
      optional={optional}
      prefix={prefix}
      showValidationIndicator={showValidationIndicator}
      title={title}
    />
  );
}

function getAppleFieldValidationIndicator({
  disabled,
  errors,
  name,
  optional = false,
  value,
}: {
  disabled?: boolean;
  errors: FieldErrors<AppleAppStoreGlobalConfiguration>;
  name: FieldPath<AppleAppStoreGlobalConfiguration>;
  optional?: boolean;
  value: unknown;
}) {
  const status = getPaymentProviderFieldValidationStatus({
    disabled,
    errors,
    fieldLabels: APPLE_APP_STORE_FIELD_LABELS,
    name,
    optional,
    value,
  });

  return <PaymentProviderFieldValidationIndicator status={status} />;
}
