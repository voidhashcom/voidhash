"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@voidhash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@voidhash/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@voidhash/ui/form";
import { Input } from "@voidhash/ui/input";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v3";
import { queryKeys, updatePaywallLocationOptions } from "@/features/studio/lib/tanstack-query";

const editPaywallLocationSchema = z.object({
  description: z.string().max(255, "Description must be less than 255 characters").optional(),
  name: z
    .string()
    .min(3, "Name must be at least 3 characters long")
    .max(64, "Name must be less than 64 characters"),
});

type EditPaywallLocationForm = z.infer<typeof editPaywallLocationSchema>;

interface EditPaywallLocationModalProps {
  initialDescription?: string | null;
  initialName: string;
  locationId: string;
  onClose: () => void;
  open: boolean;
  projectId: string;
  /** Optional inline trigger; omit when the dialog is opened from elsewhere. */
  trigger?: React.ReactNode;
}

export function EditPaywallLocationModal({
  initialDescription,
  initialName,
  locationId,
  onClose,
  open,
  projectId,
  trigger,
}: EditPaywallLocationModalProps) {
  const form = useForm<EditPaywallLocationForm>({
    defaultValues: {
      description: initialDescription ?? "",
      name: initialName,
    },
    resolver: zodResolver(editPaywallLocationSchema),
  });

  useEffect(() => {
    form.reset({
      description: initialDescription ?? "",
      name: initialName,
    });
  }, [form, initialDescription, initialName]);

  const queryClient = useQueryClient();
  const { mutate: updateLocation, status: updateLocationStatus } = useMutation({
    ...updatePaywallLocationOptions(),
    onError: () => {
      toast.error("Failed to update paywall location");
    },
    onSuccess: () => {
      toast.success("Paywall location updated");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.paywallLocation.list({ projectId }),
      });
      handleOpenChange(false);
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      form.reset({
        description: initialDescription ?? "",
        name: initialName,
      });
    }
  };

  const onSubmit = (data: EditPaywallLocationForm) => {
    updateLocation({
      description: data.description || null,
      locationId,
      name: data.name,
    });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Edit Paywall Location</DialogTitle>
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
                    <Input {...field} />
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex gap-2 sm:justify-between">
              <Button
                className="hidden md:block"
                disabled={updateLocationStatus === "pending"}
                type="button"
                variant="outline"
                onClick={() => onClose()}
              >
                Cancel
              </Button>
              <Button disabled={updateLocationStatus === "pending"} type="submit">
                {updateLocationStatus === "pending" ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
