'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Product } from '@voidhash/db';
import { Button } from '@voidhash/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
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
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { updateProductAction } from '@/lib/nextjs/server-actions';

const updateProductSchema = z.object({
  name: z.string().min(1)
});
type UpdateProductForm = z.infer<typeof updateProductSchema>;

// Define a Product type matching the DB schema

interface EditProductModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
}

export function EditProductModal({
  open,
  onClose,
  product
}: EditProductModalProps) {
  const router = useRouter();
  const form = useForm<UpdateProductForm>({
    resolver: zodResolver(updateProductSchema),
    defaultValues: {
      name: ''
    }
  });

  const { execute, isPending } = useAction(updateProductAction, {
    onSuccess: () => {
      toast.success('Product updated successfully');
      router.refresh();
      onClose?.();
      handleOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.error.serverError || 'Failed to update the product');
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: UpdateProductForm) => {
    execute({ ...data, productId: product.id });
  };

  useEffect(() => {
    if (!open) {
      form.reset({
        name: product.name
      });
    }
  }, [open, form, product.name]);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>Edit the product details.</DialogDescription>
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
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Product Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                className="mt-4 w-full"
                disabled={isPending}
                type="submit"
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
