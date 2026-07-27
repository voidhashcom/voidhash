"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSlug } from "@voidhash/core/utils";
import { InfoTooltip } from "@voidhash/ui";
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
import { createPaywallLocationOptions, queryKeys } from "@/features/studio/lib/tanstack-query";

const createPaywallLocationSchema = z.object({
  description: z.string().max(255, "Description must be less than 255 characters").optional(),
  name: z
    .string()
    .min(3, "Name must be at least 3 characters long")
    .max(64, "Name must be less than 64 characters"),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters long")
    .max(64, "Slug must be less than 64 characters")
    .regex(
      /^[a-z0-9_-]+$/,
      "Slug must contain only lowercase letters, numbers, underscores, and hyphens",
    ),
});

type CreatePaywallLocationForm = z.infer<typeof createPaywallLocationSchema>;

interface CreatePaywallLocationModalProps {
  onClose: () => void;
  onSuccess?: (location: { id: string }) => void;
  open: boolean;
  projectId: string;
  trigger: React.ReactNode;
}

export function CreatePaywallLocationModal({
  onClose,
  onSuccess,
  open,
  projectId,
  trigger,
}: CreatePaywallLocationModalProps) {
  const form = useForm<CreatePaywallLocationForm>({
    defaultValues: {
      description: "",
      name: "",
      slug: "",
    },
    resolver: zodResolver(createPaywallLocationSchema),
  });
  const name = form.watch("name");

  useEffect(() => {
    if (name && !form.formState.touchedFields.slug) {
      form.setValue("slug", createSlug(name), { shouldValidate: false });
    }
  }, [name, form]);

  const queryClient = useQueryClient();
  const { mutate: createLocation, status: createLocationStatus } = useMutation({
    ...createPaywallLocationOptions(),
    onError: () => {
      toast.error("Failed to create paywall location");
    },
    onSuccess: (data) => {
      onSuccess?.(data);
      toast.success("Paywall location created");
      queryClient.invalidateQueries({
        queryKey: queryKeys.paywallLocation.all,
      });
      handleOpenChange(false);
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      form.reset();
    }
  };

  const onSubmit = (data: CreatePaywallLocationForm) => {
    createLocation({
      description: data.description || undefined,
      name: data.name,
      projectId,
      slug: data.slug,
    });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Create Paywall Location</DialogTitle>
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
                    <Input placeholder="Onboarding Upsell" {...field} />
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
                  <FormLabel>
                    <span>Location Slug</span>
                    <InfoTooltip info="Slug is immutable and used in app code to resolve a paywall." />
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="onboarding" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Shown on first app launch" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex gap-2 sm:justify-between">
              <Button
                className="hidden md:block"
                disabled={createLocationStatus === "pending"}
                type="button"
                variant="outline"
                onClick={() => onClose()}
              >
                Cancel
              </Button>
              <Button disabled={createLocationStatus === "pending"} type="submit">
                {createLocationStatus === "pending" ? "Creating..." : "Create Location"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
