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
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from "@voidhash/ui";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createWebhookEndpointOptions, queryKeys } from "@/features/studio/lib/tanstack-query";
import { z } from "zod/v3";

import { WEBHOOK_EVENT_OPTIONS } from "./webhook-event-types";

const createWebhookSchema = z.object({
  description: z.string().optional(),
  events: z.array(z.string()).min(1, "Select at least one event"),
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  url: z.string().url("Must be a valid URL"),
});

type CreateWebhookForm = z.infer<typeof createWebhookSchema>;

interface CreateWebhookModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  projectId: string;
  onSuccess?: (webhook: typeof WebhookEndpoint.Type) => void;
}

export function CreateWebhookModal({
  open,
  onClose,
  trigger,
  projectId,
  onSuccess,
}: CreateWebhookModalProps) {
  const form = useForm<CreateWebhookForm>({
    defaultValues: {
      description: "",
      events: [],
      name: "",
      url: "",
    },
    resolver: zodResolver(createWebhookSchema),
  });

  const queryClient = useQueryClient();
  const { mutate: createWebhook, status: createWebhookStatus } = useMutation({
    ...createWebhookEndpointOptions(),
    onError: () => {
      toast.error("Failed to create webhook");
    },
    onSuccess: (data) => {
      onSuccess?.(data);
      toast.success("Webhook created successfully");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.webhook.list({ projectId }),
      });
      handleOpenChange(false);
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreateWebhookForm) => {
    createWebhook({ ...data, projectId });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4 pt-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                    <Textarea placeholder="Add a description..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex gap-2 sm:justify-between">
              <Button
                className="hidden md:block"
                disabled={createWebhookStatus === "pending"}
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={createWebhookStatus === "pending"} type="submit">
                {createWebhookStatus === "pending" ? "Creating..." : "Create Webhook"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
