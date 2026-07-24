"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSlug } from "@voidhash/core/utils";
import { Button } from "@voidhash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@voidhash/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@voidhash/ui/form";
import { Input } from "@voidhash/ui/input";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v3";
import { createPaywallOptions, queryKeys } from "@/features/studio/lib/tanstack-query";

const createPaywallSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters long")
    .max(32, "Name must be less than 32 characters"),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters long")
    .max(32, "Slug must be less than 32 characters")
    .regex(/^[\da-z-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
});

type CreatePaywallForm = z.infer<typeof createPaywallSchema>;

interface CreatePaywallModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  projectId: string;
  onSuccess?: (paywall: { id: string }) => void;
}

export function CreatePaywallModal({
  open,
  onClose,
  trigger,
  projectId,
  onSuccess,
}: CreatePaywallModalProps) {
  const form = useForm<CreatePaywallForm>({
    defaultValues: {
      name: "",
      slug: "",
    },
    resolver: zodResolver(createPaywallSchema),
  });
  const name = form.watch("name");

  useEffect(() => {
    if (name && !form.formState.touchedFields.slug) {
      form.setValue("slug", createSlug(name), { shouldValidate: false });
    }
  }, [name, form]);

  const queryClient = useQueryClient();
  const { mutate: createPaywall, status: createPaywallStatus } = useMutation({
    ...createPaywallOptions(),
    onSuccess: (data) => {
      onSuccess?.(data);
      toast.success("Paywall created successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.paywall.list({ projectId }),
      });
      handleOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to create paywall");
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreatePaywallForm) => {
    createPaywall({ ...data, projectId });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Create New Paywall</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-6 pt-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Paywall Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Paywall" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="my-paywall" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex sm:justify-between gap-2">
              <Button
                className="hidden md:block"
                disabled={createPaywallStatus === "pending"}
                type="button"
                variant="outline"
                onClick={() => onClose?.()}
              >
                Cancel
              </Button>
              <Button disabled={createPaywallStatus === "pending"} type="submit">
                {createPaywallStatus === "pending" ? "Creating Paywall..." : "Create Paywall"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
