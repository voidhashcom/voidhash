'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createSlug,
  ProductType,
  ProductTypeLabels
} from '@voidhash/lib/index';
import { Badge, InfoTooltip, RadioGroup, RadioGroupItem } from '@voidhash/ui';
import { Button } from '@voidhash/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@voidhash/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@voidhash/ui/form';
import { Input } from '@voidhash/ui/input';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod/v3';
import { createProductOptions, queryKeys } from '@/lib/tanstack-query';

const createProductSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters long')
    .max(32, 'Name must be less than 32 characters'),

  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters long')
    .max(32, 'Slug must be less than 32 characters')
    .regex(
      /^[a-z0-9_-]+$/,
      'Slug must contain only lowercase letters, numbers and hyphens'
    ),

  type: z.nativeEnum(ProductType)
});

type CreateProductForm = z.infer<typeof createProductSchema>;

// Define a Product type matching the DB schema
export type Product = {
  id: string;
  name: string;
  projectId: string;
  createdAt?: string;
  updatedAt?: string;
};

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  projectId: string;
  onSuccess?: (product: { id: string }) => void;
}

export function CreateProductModal({
  open,
  onClose,
  trigger,
  projectId,
  onSuccess
}: CreateProductModalProps) {
  const form = useForm<CreateProductForm>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: '',
      slug: '',
      type: ProductType.Subscription
    }
  });

  const name = form.watch('name');

  // Automatically generate slug if name is changed and slug is not touched
  useEffect(() => {
    if (name && !form.formState.touchedFields.slug) {
      form.setValue('slug', createSlug(name), { shouldValidate: false });
    }
  }, [name, form]);

  const queryClient = useQueryClient();
  const { mutate: createProduct, status: createProductStatus } = useMutation({
    ...createProductOptions(),
    onSuccess: (data) => {
      onSuccess?.(data);
      toast.success('Product created successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.product.list({ projectId })
      });
      handleOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to create product');
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreateProductForm) => {
    createProduct({ ...data, projectId });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Product</DialogTitle>
          <DialogDescription>
            Create a new product for your project.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-6 pt-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
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
                      defaultValue={field.value.toString()}
                      onValueChange={field.onChange}
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem
                            value={ProductType.Subscription.toString()}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          <span>
                            {ProductTypeLabels[ProductType.Subscription]}
                          </span>
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 opacity-50">
                        <FormControl>
                          <RadioGroupItem
                            disabled={true}
                            value={ProductType.OneTime.toString()}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          <span className="flex items-center gap-2">
                            <span>
                              {ProductTypeLabels[ProductType.OneTime]}
                            </span>
                            <Badge variant="outline">Coming Soon</Badge>
                          </span>
                          <InfoTooltip info="One-time products can only be purchased once per customer. For example: Lifetime access to a course." />
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 opacity-50">
                        <FormControl>
                          <RadioGroupItem
                            disabled={true}
                            value={ProductType.OneTimeConsumable.toString()}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          <span className="flex items-center gap-2">
                            <span>
                              {ProductTypeLabels[ProductType.OneTimeConsumable]}
                            </span>
                            <Badge variant="outline">Coming Soon</Badge>
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

            <DialogFooter>
              <Button
                className="mt-4 w-full"
                disabled={createProductStatus === 'pending'}
                type="submit"
              >
                {createProductStatus === 'pending'
                  ? 'Creating Product...'
                  : 'Create Product'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
