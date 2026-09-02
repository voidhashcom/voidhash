"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Button, Input, Switch } from "@voidhash/ui";
import { useState } from "react";
import { toast } from "sonner";

import { queryKeys } from "@/features/studio/lib/tanstack-query";
import {
  getEventAdmissionPolicyOptions,
  setBuiltinEventAdmissionOptions,
  setCustomEventBlockedOptions,
} from "@/features/studio/lib/tanstack-query/event-admission";
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/features/studio/settings";

/**
 * Project settings for event admission: per-event toggles over the built-in
 * (`$`-prefixed) registry, plus the blocklist for custom event names. Custom
 * events are stored by default, so the blocklist is the only control they need.
 */
export function ProjectEventsPage({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { data: policy } = useSuspenseQuery(getEventAdmissionPolicyOptions({ projectId }));
  const [blockedEventName, setBlockedEventName] = useState("");

  const invalidatePolicy = () =>
    void queryClient.invalidateQueries({
      queryKey: queryKeys.eventAdmission.policy({ projectId }),
    });

  const { mutate: setBuiltinEnabled, isPending: isTogglePending } = useMutation({
    ...setBuiltinEventAdmissionOptions(),
    onSuccess: invalidatePolicy,
    onError: () => toast.error("Failed to update the event"),
  });

  const { mutate: setCustomBlocked, isPending: isBlocklistPending } = useMutation({
    ...setCustomEventBlockedOptions(),
    onSuccess: () => {
      setBlockedEventName("");
      invalidatePolicy();
    },
    onError: () => toast.error("Failed to update the blocked events"),
  });

  const trimmedEventName = blockedEventName.trim();
  const canBlock =
    trimmedEventName.length > 0 &&
    !trimmedEventName.startsWith("$") &&
    !policy.customEventBlocklist.includes(trimmedEventName);

  return (
    <SettingsPage description="Choose which events this project stores." title="Events">
      <SettingsSection
        description="Events the SDK and voidhash emit automatically. Each one is stored only while it is turned on."
        title="Built-in events"
      >
        <SettingsCard>
          {policy.builtinEvents.map((event) => (
            <SettingsRow
              control={
                <Switch
                  checked={event.isEnabled}
                  disabled={isTogglePending}
                  onCheckedChange={(enabled) =>
                    setBuiltinEnabled({ enabled: enabled === true, key: event.key, projectId })
                  }
                />
              }
              description={event.description}
              key={event.key}
              status={event.warning}
              title={event.name}
            />
          ))}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description="Your own events are stored by default. Add a name here to stop storing it."
        title="Custom events"
      >
        <SettingsCard
          footer={
            <>
              <span className="text-[12px] text-muted-foreground">
                Reserved names starting with $ are managed above.
              </span>
              <Button
                disabled={!canBlock || isBlocklistPending}
                onClick={() =>
                  setCustomBlocked({ blocked: true, eventName: trimmedEventName, projectId })
                }
                size="sm"
                type="button"
              >
                Block
              </Button>
            </>
          }
        >
          <SettingsRow
            control={
              <Input
                className="sm:w-64"
                onChange={(changeEvent) => setBlockedEventName(changeEvent.target.value)}
                placeholder="checkout_started"
                value={blockedEventName}
              />
            }
            description="Events with this exact name are rejected at ingest."
            title="Blocked event name"
          />
          {policy.customEventBlocklist.map((eventName) => (
            <SettingsRow
              control={
                <Button
                  disabled={isBlocklistPending}
                  onClick={() => setCustomBlocked({ blocked: false, eventName, projectId })}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Unblock
                </Button>
              }
              key={eventName}
              title={eventName}
            />
          ))}
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}
