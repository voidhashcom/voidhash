"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@voidhash/rpc";
import { Button } from "@voidhash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { queryKeys, updateProductOptions } from "@/features/studio/lib/tanstack-query";
import { z } from "zod/v3";

const updateProductSchema = z.object({
  name: z.string().min(1),
});
type UpdateProductForm = z.infer<typeof updateProductSchema>;

// Define a Product type matching the DB schema

interface EditProductModalProps {
  open: boolean;
  onClose: () => void;
  product: typeof Product.Type;
}

export function EditProductModal({ open, onClose, product }: EditProductModalProps) {
  const form = useForm<UpdateProductForm>({
    defaultValues: {
      name: "",
    },
    resolver: zodResolver(updateProductSchema),
  });

  const queryClient = useQueryClient();
  const { mutate: updateProduct, status: updateProductStatus } = useMutation({
    ...updateProductOptions(),
    onSuccess: () => {
      toast.success("Product updated successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.product.list({ projectId: product.projectId }),
      });
      onClose?.();
      handleOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to update the product");
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: UpdateProductForm) => {
    updateProduct({ ...data, id: product.id });
  };

  useEffect(() => {
    if (!open) {
      form.reset({
        name: product.name,
      });
    }
  }, [open, form, product.name]);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4 pt-4" onSubmit={form.handleSubmit(onSubmit)}>
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
            <DialogFooter className="flex sm:justify-between gap-2">
              <Button
                className="hidden md:block"
                disabled={updateProductStatus === "pending"}
                type="button"
                variant="outline"
                onClick={() => onClose?.()}
              >
                Cancel
              </Button>
              <Button disabled={updateProductStatus === "pending"} type="submit">
                {updateProductStatus === "pending" ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
