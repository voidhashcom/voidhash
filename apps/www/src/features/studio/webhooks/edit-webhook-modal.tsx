"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WebhookEndpoint } from "@voidhash/rpc";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Switch,
  Textarea,
} from "@voidhash/ui";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { queryKeys, updateWebhookEndpointOptions } from "@/features/studio/lib/tanstack-query";
import { z } from "zod/v3";

import { WEBHOOK_EVENT_OPTIONS } from "./webhook-event-types";

const editWebhookSchema = z.object({
  description: z.string().nullable().optional(),
  enabled: z.boolean(),
  events: z.array(z.string()).min(1, "Select at least one event"),
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  url: z.string().url("Must be a valid URL"),
});

type EditWebhookForm = z.infer<typeof editWebhookSchema>;

interface EditWebhookModalProps {
  open: boolean;
  onClose: () => void;
  webhook: typeof WebhookEndpoint.Type;
  projectId: string;
}

export function EditWebhookModal({ open, onClose, webhook, projectId }: EditWebhookModalProps) {
  const form = useForm<EditWebhookForm>({
    defaultValues: {
      description: webhook.description ?? "",
      enabled: webhook.status === "active",
      events: [...webhook.events],
      name: webhook.name,
      url: webhook.url,
    },
    resolver: zodResolver(editWebhookSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset({
        description: webhook.description ?? "",
        enabled: webhook.status === "active",
        events: [...webhook.events],
        name: webhook.name,
        url: webhook.url,
      });
    }
  }, [open, webhook, form]);

  const queryClient = useQueryClient();
  const { mutate: updateWebhook, status: updateWebhookStatus } = useMutation({
    ...updateWebhookEndpointOptions(),
    onError: () => {
      toast.error("Failed to update webhook");
    },
    onSuccess: () => {
      toast.success("Webhook updated successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.webhook.list({ projectId }),
      });
      onClose();
    },
  });

  const onSubmit = (data: EditWebhookForm) => {
    updateWebhook({
      description: data.description,
      endpointId: webhook.id,
      events: data.events,
      name: data.name,
      status: data.enabled ? "active" : "disabled",
      url: data.url,
    });
  };

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Edit Webhook</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4 pt-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Enabled</FormLabel>
                    <p className="text-muted-foreground text-sm">Receive webhook notifications</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My webhook" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/webhook" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="events"
              render={() => (
                <FormItem className="space-y-2">
                  <FormLabel>Events</FormLabel>
                  <div className="grid grid-cols-1 gap-2">
                    {WEBHOOK_EVENT_OPTIONS.map((event) => (
                      <FormField
                        control={form.control}
                        key={event.value}
                        name="events"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(event.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...field.value, event.value]);
                                  } else {
                                    field.onChange(field.value?.filter((v) => v !== event.value));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{event.label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a description..."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex gap-2 sm:justify-between">
              <Button
                className="hidden md:block"
                disabled={updateWebhookStatus === "pending"}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={updateWebhookStatus === "pending"} type="submit">
                {updateWebhookStatus === "pending" ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
