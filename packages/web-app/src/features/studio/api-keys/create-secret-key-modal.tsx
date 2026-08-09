"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiKeyWithRawKey } from "@voidhash/rpc";
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
import { createSecretKeyOptions, queryKeys } from "@/features/studio/lib/tanstack-query";
import { z } from "zod/v3";

const createSecretKeySchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters long")
    .max(32, "Name must be less than 32 characters"),
});

type CreateSecretKeyForm = z.infer<typeof createSecretKeySchema>;

interface CreateSecretKeyModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  projectId: string;
  onSuccess?: (apiKey: typeof ApiKeyWithRawKey.Type) => void;
}

export function CreateSecretKeyModal({
  open,
  onClose,
  trigger,
  projectId,
  onSuccess,
}: CreateSecretKeyModalProps) {
  const form = useForm<CreateSecretKeyForm>({
    defaultValues: {
      name: "",
    },
    resolver: zodResolver(createSecretKeySchema),
  });

  const queryClient = useQueryClient();
  const { mutate: createSecretKey, status: createSecretKeyStatus } = useMutation({
    ...createSecretKeyOptions(),
    onSuccess: (data) => {
      onSuccess?.(data);
      toast.success("Key successfully created");
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKey.all });
    },
    onError: () => {
      toast.error("Failed to create key");
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreateSecretKeyForm) => {
    createSecretKey({ ...data, projectId });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Create Secret Key</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4 pt-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Key Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Production API Key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex sm:justify-between gap-2">
              <Button
                className="hidden md:block"
                disabled={createSecretKeyStatus === "pending"}
                type="button"
                variant="outline"
                onClick={() => onClose?.()}
              >
                Cancel
              </Button>
              <Button disabled={createSecretKeyStatus === "pending"} type="submit">
                {createSecretKeyStatus === "pending" ? "Creating Key..." : "Create Key"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
