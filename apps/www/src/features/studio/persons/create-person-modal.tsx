"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createPersonOptions, queryKeys } from "@/features/studio/lib/tanstack-query";
import { z } from "zod/v3";

// Extract the relevant parts from the person creation input schema for the form
const createPersonFormSchema = z.object({
  distinctId: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

type CreatePersonForm = z.infer<typeof createPersonFormSchema>;

interface CreatePersonModalProps {
  trigger: React.ReactNode;
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function CreatePersonModal({ open, onClose, trigger, projectId }: CreatePersonModalProps) {
  const form = useForm<CreatePersonForm>({
    defaultValues: {
      distinctId: "",
      email: "",
      name: "",
    },
    resolver: zodResolver(createPersonFormSchema),
  });

  const queryClient = useQueryClient();
  const { mutate: createPerson, status: createPersonStatus } = useMutation({
    ...createPersonOptions(),
    onSuccess: () => {
      toast.success("Person created successfully");
      queryClient.invalidateQueries({ queryKey: queryKeys.person.all });
    },
    onError: () => {
      toast.error("Failed to create person");
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreatePersonForm) => {
    createPerson({ ...data, projectId });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Create Person</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-6 pt-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="distinctId"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>
                    Distinct ID{" "}
                    <InfoTooltip info="Distinct ID links your application's person identity with its corresponding Voidhash person profile." />
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="#######" {...field} />
                  </FormControl>
                  <FormMessage />
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
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john.doe@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex sm:justify-between gap-2">
              <Button
                className="hidden md:block"
                disabled={createPersonStatus === "pending"}
                type="button"
                variant="outline"
                onClick={() => onClose?.()}
              >
                Cancel
              </Button>
              <Button disabled={createPersonStatus === "pending"} type="submit">
                {createPersonStatus === "pending" ? "Creating Person..." : "Create Person"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
