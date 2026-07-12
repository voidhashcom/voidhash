"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { PushNotificationConfiguration } from "@voidhash/rpc";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@voidhash/ui";
import { EllipsisVerticalIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";
import { SettingsCard, SettingsPage, SettingsRow, SettingsSection } from "@/features/studio/settings";

import { NotificationProviderDetailPageChrome } from "../components/notification-provider-detail-page-chrome";
import { notificationProviders } from "../notification-providers";
import { useNotificationConfigurationMutations } from "../use-notification-configuration-mutations";

/** Non-secret read shape of an FCM configuration as returned by the backend. */
interface FcmReadConfiguration {
  projectId?: string;
  androidPriority?: "high" | "normal";
  androidTtl?: string;
  apnsPriority?: "5" | "10";
  hasServiceAccountJson?: boolean;
}

const fcmFormSchema = z.object({
  projectId: z.string().min(1, "Firebase project ID is required"),
  serviceAccountJson: z.string(),
  androidPriority: z.enum(["high", "normal"]),
  androidTtl: z.string(),
  apnsPriority: z.enum(["5", "10"]),
});

type FcmForm = z.infer<typeof fcmFormSchema>;

const fcmProvider = notificationProviders.find((p) => p.id === "fcm");

export function FcmNotificationProviderDetailPage({
  organizationSlug,
  projectSlug,
  pushNotificationConfiguration,
}: {
  organizationSlug: string;
  projectSlug: string;
  project: { id: string };
  pushNotificationConfiguration: typeof PushNotificationConfiguration.Type;
}) {
  const configuration = pushNotificationConfiguration.configuration as FcmReadConfiguration;
  const hasServiceAccountJson = Boolean(configuration.hasServiceAccountJson);

  const form = useForm<FcmForm>({
    defaultValues: {
      projectId: configuration.projectId ?? "",
      // Secrets are never returned by the read DTO — leave the field blank so we
      // only send a new secret when the user actually types one.
      serviceAccountJson: "",
      androidPriority: configuration.androidPriority ?? "high",
      androidTtl: configuration.androidTtl ?? "",
      apnsPriority: configuration.apnsPriority ?? "10",
    },
    resolver: zodResolver(fcmFormSchema),
  });

  const {
    ConfirmationDialog,
    deleteConfiguration,
    isDeleting,
    isSaving,
    openDialog,
    updateConfiguration,
  } = useNotificationConfigurationMutations({
    organizationSlug,
    projectSlug,
    providerTitle: fcmProvider?.title ?? "Firebase Cloud Messaging",
  });

  /**
   * Build the write `configuration` payload, only including the secret when the
   * user provided a non-empty value so that leaving it blank never blanks the
   * stored service-account JSON.
   */
  const buildConfiguration = (values: FcmForm): Record<string, unknown> => {
    const next: Record<string, unknown> = {
      projectId: values.projectId,
      androidPriority: values.androidPriority,
      apnsPriority: values.apnsPriority,
    };
    if (values.androidTtl.trim().length > 0) {
      next.androidTtl = values.androidTtl.trim();
    }
    if (values.serviceAccountJson.trim().length > 0) {
      next.serviceAccountJson = values.serviceAccountJson;
    }
    return next;
  };

  const save = (values: FcmForm, enabled: boolean) => {
    updateConfiguration({
      configuration: buildConfiguration(values),
      enabled,
      id: pushNotificationConfiguration.id,
      name: pushNotificationConfiguration.name,
    });
  };

  const onSubmit = form.handleSubmit((values) => {
    save(values, pushNotificationConfiguration.enabled);
  });

  const toggleEnabled = async (nextEnabled: boolean) => {
    const isValid = await form.trigger();
    if (!isValid) {
      return;
    }

    const values = form.getValues();
    // Enabling for the first time requires the service-account JSON to be
    // present — either already stored or freshly entered.
    if (nextEnabled && !hasServiceAccountJson && values.serviceAccountJson.trim().length === 0) {
      const shouldContinue = await openDialog({
        description:
          "A service account JSON is required before this provider can be enabled. Add it and save first.",
        title: "Service account required",
      });
      if (shouldContinue) {
        form.setFocus("serviceAccountJson");
      }
      return;
    }

    save(values, nextEnabled);
  };

  return (
    <NotificationProviderDetailPageChrome
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
                void deleteConfiguration(pushNotificationConfiguration.id);
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
      providerName="Firebase Cloud Messaging"
    >
      <Form {...form}>
        <form onSubmit={onSubmit}>
          <SettingsPage
            description="Deliver push notifications to Android devices via Google FCM."
            title="Firebase Cloud Messaging"
          >
            <SettingsSection title="Status">
              <SettingsCard>
                <SettingsRow
                  control={
                    <Switch
                      checked={pushNotificationConfiguration.enabled}
                      disabled={isSaving}
                      onCheckedChange={(checked) => void toggleEnabled(checked)}
                    />
                  }
                  description="Enable delivery through this provider. A service account is required."
                  status={
                    pushNotificationConfiguration.enabled ? (
                      <Badge className="text-[11px]">Enabled</Badge>
                    ) : (
                      <Badge className="text-[11px]" variant="outline">
                        Disabled
                      </Badge>
                    )
                  }
                  title="Enabled"
                />
              </SettingsCard>
            </SettingsSection>

            <SettingsSection title="Credentials">
              <SettingsCard
                footer={
                  <>
                    <span className="text-[12px] text-muted-foreground">
                      {hasServiceAccountJson
                        ? "A service account is configured. Leave the field blank to keep it."
                        : "Add your service account JSON to enable delivery."}
                    </span>
                    <Button disabled={isSaving} size="sm" type="submit">
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </>
                }
              >
                <SettingsRow
                  control={
                    <FormField
                      control={form.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem className="w-full sm:w-64">
                          <FormControl>
                            <Input placeholder="my-firebase-project" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  }
                  description="The Firebase project ID that owns the app."
                  title="Firebase project ID"
                />

                <SettingsRow title="Service account JSON">
                  <FormField
                    control={form.control}
                    name="serviceAccountJson"
                    render={({ field }) => (
                      <FormItem>
                        {hasServiceAccountJson ? (
                          <Badge className="text-[11px]" variant="outline">
                            Configured ✓
                          </Badge>
                        ) : null}
                        <FormControl>
                          <Textarea
                            className="min-h-32 font-mono text-xs"
                            placeholder={
                              hasServiceAccountJson
                                ? "Leave blank to keep the existing service account"
                                : "Paste the service account JSON"
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The Firebase service account JSON used to authenticate with FCM. It is
                          never displayed after saving.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsRow>
              </SettingsCard>
            </SettingsSection>

            <SettingsSection title="Delivery options">
              <SettingsCard>
                <SettingsRow
                  control={
                    <FormField
                      control={form.control}
                      name="androidPriority"
                      render={({ field }) => (
                        <FormItem className="w-full sm:w-40">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  }
                  description="Android delivery priority."
                  title="Android priority"
                />

                <SettingsRow
                  control={
                    <FormField
                      control={form.control}
                      name="androidTtl"
                      render={({ field }) => (
                        <FormItem className="w-full sm:w-40">
                          <FormControl>
                            <Input placeholder="3600s" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  }
                  description="Optional time-to-live (e.g. 3600s)."
                  title="Android TTL"
                />

                <SettingsRow
                  control={
                    <FormField
                      control={form.control}
                      name="apnsPriority"
                      render={({ field }) => (
                        <FormItem className="w-full sm:w-40">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  }
                  description="APNs priority used for FCM-relayed iOS delivery."
                  title="APNs priority"
                />
              </SettingsCard>
            </SettingsSection>
          </SettingsPage>

          <ConfirmationDialog />
        </form>
      </Form>
    </NotificationProviderDetailPageChrome>
  );
}
