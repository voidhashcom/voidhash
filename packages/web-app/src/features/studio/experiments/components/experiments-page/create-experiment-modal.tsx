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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v3";

import { createExperimentOptions, queryKeys } from "@/features/studio/lib/tanstack-query";

const createExperimentSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters long")
    .max(64, "Name must be less than 64 characters"),
});

type CreateExperimentForm = z.infer<typeof createExperimentSchema>;

interface CreateExperimentModalProps {
  organizationSlug: string;
  projectId: string;
  projectSlug: string;
  trigger: React.ReactNode;
}

/**
 * Dialog for creating an A/B test. A test starts as an empty draft that assigns
 * no traffic, so the only thing worth asking for up front is a name — variants,
 * treatments and metrics are authored on the detail page we land on.
 */
export function CreateExperimentModal({
  organizationSlug,
  projectId,
  projectSlug,
  trigger,
}: CreateExperimentModalProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<CreateExperimentForm>({
    defaultValues: { name: "" },
    resolver: zodResolver(createExperimentSchema),
  });

  const { mutate: createExperiment, status: createExperimentStatus } = useMutation({
    ...createExperimentOptions(),
    onError: () => {
      toast.error("Failed to create A/B test");
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.experiment.all });
      handleOpenChange(false);
      void navigate({
        params: { id: data.id, organizationSlug, projectSlug },
        to: "/studio/$organizationSlug/$projectSlug/experiments/$id",
      });
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset();
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Create A/B test</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4 pt-4"
            onSubmit={form.handleSubmit((data) => createExperiment({ name: data.name, projectId }))}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Onboarding paywall pricing" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex gap-2 sm:justify-between">
              <Button
                className="hidden md:block"
                disabled={createExperimentStatus === "pending"}
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={createExperimentStatus === "pending"} type="submit">
                {createExperimentStatus === "pending" ? "Creating..." : "Create A/B test"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
