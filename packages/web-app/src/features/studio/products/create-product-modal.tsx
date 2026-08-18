"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ProductType,
  ProductTypeLabels,
  SubscriptionDuration,
  SubscriptionDurationLabels,
} from "@voidhash/lib";
import { createSlug } from "@voidhash/core/utils";
import { InfoTooltip, RadioGroup, RadioGroupItem } from "@voidhash/ui";
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
import { createProductOptions, queryKeys } from "@/features/studio/lib/tanstack-query";
import { z } from "zod/v3";

const createProductSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters long")
    .max(32, "Name must be less than 32 characters"),

  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters long")
    .max(32, "Slug must be less than 32 characters")
    .regex(/^[a-z0-9_-]+$/, "Slug must contain only lowercase letters, numbers and hyphens"),

  type: z.nativeEnum(ProductType),
  duration: z.nativeEnum(SubscriptionDuration),
});

type CreateProductForm = z.infer<typeof createProductSchema>;

// Define a Product type matching the DB schema
export interface Product {
  id: string;
  name: string;
  projectId: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  trigger?: React.ReactNode;
  projectId: string;
  onSuccess?: (product: { id: string }) => void;
}

export function CreateProductModal({
  open,
  onClose,
  trigger,
  projectId,
  onSuccess,
}: CreateProductModalProps) {
  const form = useForm<CreateProductForm>({
    defaultValues: {
      name: "",
      slug: "",
      type: ProductType.Subscription,
      duration: SubscriptionDuration.Monthly,
    },
    resolver: zodResolver(createProductSchema),
  });

  const name = form.watch("name");
  const productType = form.watch("type");

  // Automatically generate slug if name is changed and slug is not touched
  useEffect(() => {
    if (name && !form.formState.touchedFields.slug) {
      form.setValue("slug", createSlug(name), { shouldValidate: false });
    }
  }, [name, form]);

  const queryClient = useQueryClient();
  const { mutate: createProduct, status: createProductStatus } = useMutation({
    ...createProductOptions(),
    onSuccess: (data) => {
      onSuccess?.(data);
      toast.success("Product created successfully");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.product.list({ projectId }),
      });
      handleOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to create product");
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreateProductForm) => {
    createProduct({
      duration: data.type === ProductType.Subscription ? data.duration : undefined,
      name: data.name,
      projectId,
      slug: data.slug,
      type: data.type,
    });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Create New Product</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-6 pt-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Product Name" {...field} />
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
                    <Input placeholder="Product Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Product type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      className="flex flex-col space-y-1"
                      defaultValue={field.value?.toString()}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={ProductType.Subscription.toString()} />
                        </FormControl>
                        <FormLabel className="font-normal">
                          <span>{ProductTypeLabels[ProductType.Subscription]}</span>
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={ProductType.OneTime.toString()} />
                        </FormControl>
                        <FormLabel className="font-normal">
                          <span className="flex items-center gap-2">
                            <span>{ProductTypeLabels[ProductType.OneTime]}</span>
                          </span>
                          <InfoTooltip info="One-time products can only be purchased once per person. For example: Lifetime access to a course." />
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={ProductType.OneTimeConsumable.toString()} />
                        </FormControl>
                        <FormLabel className="font-normal">
                          <span className="flex items-center gap-2">
                            <span>{ProductTypeLabels[ProductType.OneTimeConsumable]}</span>
                          </span>
                          <InfoTooltip info="One-time consumable products can be purchased multiple times. For example: Battle passes, in-game currency, etc." />
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {productType === ProductType.Subscription && (
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Billing duration</FormLabel>
                    <FormControl>
                      <RadioGroup
                        className="grid grid-cols-2 gap-2"
                        value={field.value.toString()}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        {Object.values(SubscriptionDuration).map((duration) => (
                          <FormItem
                            className="flex items-center space-x-2 space-y-0"
                            key={duration}
                          >
                            <FormControl>
                              <RadioGroupItem value={duration.toString()} />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {SubscriptionDurationLabels[duration]}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="flex sm:justify-between gap-2">
              <Button
                className="hidden md:block"
                disabled={createProductStatus === "pending"}
                type="button"
                variant="outline"
                onClick={() => onClose?.()}
              >
                Cancel
              </Button>
              <Button disabled={createProductStatus === "pending"} type="submit">
                {createProductStatus === "pending" ? "Creating Product..." : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
