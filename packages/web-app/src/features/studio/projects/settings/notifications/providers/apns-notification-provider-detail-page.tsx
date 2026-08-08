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
import { useForm } from "react-hook-form";
import { z } from "zod/v3";
import { SettingsCard, SettingsPage, SettingsRow, SettingsSection } from "@/features/studio/settings";

import { NotificationProviderDetailPageChrome } from "../components/notification-provider-detail-page-chrome";
import { notificationProviders } from "../notification-providers";
import { useNotificationConfigurationMutations } from "../use-notification-configuration-mutations";

/** Non-secret read shape of an APNs configuration as returned by the backend. */
interface ApnsReadConfiguration {
  teamId?: string;
  keyId?: string;
  bundleId?: string;
  environment?: "sandbox" | "production";
  hasPrivateKey?: boolean;
}

const apnsFormSchema = z.object({
  teamId: z.string().length(10, "Team ID must be 10 characters"),
  keyId: z.string().min(1, "Key ID is required"),
  bundleId: z.string().min(1, "Bundle ID is required"),
  environment: z.enum(["sandbox", "production"]),
  privateKeyContent: z.string(),
});

type ApnsForm = z.infer<typeof apnsFormSchema>;

const apnsProvider = notificationProviders.find((p) => p.id === "apns");

export function ApnsNotificationProviderDetailPage({
  organizationSlug,
  projectSlug,
  pushNotificationConfiguration,
}: {
  organizationSlug: string;
  projectSlug: string;
  project: { id: string };
  pushNotificationConfiguration: typeof PushNotificationConfiguration.Type;
}) {
  const configuration = pushNotificationConfiguration.configuration as ApnsReadConfiguration;
  const hasPrivateKey = Boolean(configuration.hasPrivateKey);

  const form = useForm<ApnsForm>({
    defaultValues: {
      teamId: configuration.teamId ?? "",
      keyId: configuration.keyId ?? "",
      bundleId: configuration.bundleId ?? "",
      environment: configuration.environment ?? "production",
      // Secrets are never returned by the read DTO — leave blank so we only send
      // a new key when the user actually types one.
      privateKeyContent: "",
    },
    resolver: zodResolver(apnsFormSchema),
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
    providerTitle: apnsProvider?.title ?? "Apple Push Notification service",
  });

  /**
   * Build the write `configuration` payload, only including the secret when the
   * user provided a non-empty value so that leaving it blank never blanks the
   * stored `.p8` private key.
   */
  const buildConfiguration = (values: ApnsForm): Record<string, unknown> => {
    const next: Record<string, unknown> = {
      teamId: values.teamId,
      keyId: values.keyId,
      bundleId: values.bundleId,
      environment: values.environment,
    };
    if (values.privateKeyContent.trim().length > 0) {
      next.privateKeyContent = values.privateKeyContent;
    }
    return next;
  };

  const save = (values: ApnsForm, enabled: boolean) => {
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
    // Enabling for the first time requires the private key to be present —
    // either already stored or freshly entered.
    if (nextEnabled && !hasPrivateKey && values.privateKeyContent.trim().length === 0) {
      const shouldContinue = await openDialog({
        description:
          "A private key (.p8) is required before this provider can be enabled. Add it and save first.",
        title: "Private key required",
      });
      if (shouldContinue) {
        form.setFocus("privateKeyContent");
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
      providerName="Apple Push Notification service"
    >
      <Form {...form}>
        <form onSubmit={onSubmit}>
          <SettingsPage
            description="Deliver push notifications to iOS devices via Apple APNs."
            title="Apple Push Notification service"
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
                  description="Enable delivery through this provider. A private key is required."
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
                      {hasPrivateKey
                        ? "A private key is configured. Leave the field blank to keep it."
                        : "Add your .p8 private key to enable delivery."}
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
                      name="teamId"
                      render={({ field }) => (
                        <FormItem className="w-full sm:w-64">
                          <FormControl>
                            <Input placeholder="ABCDE12345" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  }
                  description="Your 10-character Apple Developer Team ID."
                  title="Team ID"
                />

                <SettingsRow
                  control={
                    <FormField
                      control={form.control}
                      name="keyId"
                      render={({ field }) => (
                        <FormItem className="w-full sm:w-64">
                          <FormControl>
                            <Input placeholder="ABC123DEFG" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  }
                  description="The Key ID of the APNs auth key."
                  title="Key ID"
                />

                <SettingsRow
                  control={
                    <FormField
                      control={form.control}
                      name="bundleId"
                      render={({ field }) => (
                        <FormItem className="w-full sm:w-64">
                          <FormControl>
                            <Input placeholder="com.example.app" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  }
                  description="The app's bundle identifier."
                  title="Bundle ID"
                />

                <SettingsRow
                  control={
                    <FormField
                      control={form.control}
                      name="environment"
                      render={({ field }) => (
                        <FormItem className="w-full sm:w-40">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="production">Production</SelectItem>
                              <SelectItem value="sandbox">Sandbox</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  }
                  description="Which APNs environment to deliver to."
                  title="Environment"
                />

                <SettingsRow title="Private key (.p8)">
                  <FormField
                    control={form.control}
                    name="privateKeyContent"
                    render={({ field }) => (
                      <FormItem>
                        {hasPrivateKey ? (
                          <Badge className="text-[11px]" variant="outline">
                            Configured ✓
                          </Badge>
                        ) : null}
                        <FormControl>
                          <Textarea
                            className="min-h-32 font-mono text-xs"
                            placeholder={
                              hasPrivateKey
                                ? "Leave blank to keep the existing private key"
                                : "-----BEGIN PRIVATE KEY-----"
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The APNs auth key PEM (.p8). It is never displayed after saving.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsRow>
              </SettingsCard>
            </SettingsSection>
          </SettingsPage>

          <ConfirmationDialog />
        </form>
      </Form>
    </NotificationProviderDetailPageChrome>
  );
}
