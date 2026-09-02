"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  addCreatedOrganizationToCurrentUserCache,
  createOrganizationOptions,
} from "@/features/studio/lib/tanstack-query/organizations";
import { z } from "zod/v3";

const createOrganizationFormSchema = z.object({
  name: z
    .string()
    .min(3, "Organization name must be at least 3 characters")
    .max(32, "Organization name must be less than 32 characters"),
});

type CreateOrganizationForm = z.infer<typeof createOrganizationFormSchema>;

interface CreateOrganizationModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
}

export function CreateOrganizationModal({ open, onClose, trigger }: CreateOrganizationModalProps) {
  const navigate = useNavigate();
  const form = useForm<CreateOrganizationForm>({
    defaultValues: {
      name: "",
    },
    resolver: zodResolver(createOrganizationFormSchema),
  });

  const queryClient = useQueryClient();
  const { mutate: createOrganization, status: createOrganizationStatus } = useMutation({
    ...createOrganizationOptions(),
    onSuccess: (data) => {
      toast.success("Organization created successfully");
      addCreatedOrganizationToCurrentUserCache(queryClient, data);
      void navigate({
        params: {
          organizationSlug: data.slug,
        },
        to: "/studio/$organizationSlug",
      });
    },
    onError: () => {
      toast.error("Failed to create organization");
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreateOrganizationForm) => {
    createOrganization({ name: data.name });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4 pt-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Team Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex sm:justify-between gap-2">
              <Button
                className="hidden md:block"
                disabled={createOrganizationStatus === "pending"}
                type="button"
                variant="outline"
                onClick={() => onClose?.()}
              >
                Cancel
              </Button>
              <Button disabled={createOrganizationStatus === "pending"} type="submit">
                {createOrganizationStatus === "pending" ? "Creating Team..." : "Create Team"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
