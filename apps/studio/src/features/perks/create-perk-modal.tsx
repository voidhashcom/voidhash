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
import { createPerkOptions, queryKeys } from "src/lib/tanstack-query";
import { z } from "zod/v3";

const createPerkSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters long")
    .max(32, "Name must be less than 32 characters"),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters long")
    .max(32, "Slug must be less than 32 characters")
    .regex(
      /^[a-z0-9_-]+$/,
      "Slug must contain only lowercase letters, numbers, underscores, and hyphens"
    ),
});

type CreatePerkForm = z.infer<typeof createPerkSchema>;

interface CreatePerkModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  projectId: string;
  onSuccess?: (perk: { id: string }) => void;
}

export function CreatePerkModal({
  open,
  onClose,
  trigger,
  projectId,
  onSuccess,
}: CreatePerkModalProps) {
  const form = useForm<CreatePerkForm>({
    defaultValues: {
      name: "",
      slug: "",
    },
    resolver: zodResolver(createPerkSchema),
  });

  const queryClient = useQueryClient();
  const { mutate: createPerk, status: createPerkStatus } = useMutation({
    ...createPerkOptions(),
    onSuccess: (data) => {
      onSuccess?.(data);
      toast.success("Perk created successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.perk.list({ projectId }),
      });
      handleOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to create perk");
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreatePerkForm) => {
    createPerk({ ...data, projectId });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      {/* @ts-expect-error React types version conflict between @types/react and @radix-ui */}
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Perk</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4 pt-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="All-Access, AI-features, etc."
                      {...field}
                    />
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
                    <span>Slug (ID)</span>
                    <InfoTooltip info="Slugs are unique identifiers used to reference the perk in code." />
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="all-access, ai-features, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                className="mt-4 w-full"
                disabled={createPerkStatus === "pending"}
                type="submit"
              >
                {createPerkStatus === "pending"
                  ? "Creating Perk..."
                  : "Create Perk"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
