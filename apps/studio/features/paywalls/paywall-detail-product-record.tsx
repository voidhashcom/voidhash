'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Product } from '@voidhash/db';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@voidhash/ui';
import { EllipsisVerticalIcon, GripVerticalIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const paywallProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters long'),
  enableNativePurchase: z.boolean(),
  enableWebCheckout: z.boolean(),
  webCheckoutPaymentProviderConfigurationProductId: z.string().nullable()
});

type PaywallProductForm = z.infer<typeof paywallProductSchema>;

export function PaywallDetailProductRecord({
  product,
  paywallProduct,
  onUpdate,
  onRemove
}: {
  product: Product;
  paywallProduct: {
    productId: string;
    displayName: string;
    enableNativePurchase: boolean;
    enableWebCheckout: boolean;
    webCheckoutPaymentProviderConfigurationProductId: string | null;
  };
  onUpdate: (data: PaywallProductForm) => void;
  onRemove: () => void;
}) {
  const form = useForm<PaywallProductForm>({
    resolver: zodResolver(paywallProductSchema),
    defaultValues: {
      productId: paywallProduct.productId,
      displayName: paywallProduct.displayName,
      enableNativePurchase: paywallProduct.enableNativePurchase,
      enableWebCheckout: paywallProduct.enableWebCheckout,
      webCheckoutPaymentProviderConfigurationProductId:
        paywallProduct.webCheckoutPaymentProviderConfigurationProductId
    }
  });

  const handleOnUpdate = (data: Partial<PaywallProductForm>) => {
    onUpdate({
      ...form.getValues(),
      ...data
    });
  };

  // Makes the form "controlled"
  useEffect(() => {
    form.reset(paywallProduct);
  }, [paywallProduct, form]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: paywallProduct.productId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined // Ensure the dragged item is on top
  };

  return (
    <Form {...form}>
      <div className="space-y-6" ref={setNodeRef} style={style}>
        <Card className="gap-0 pt-3 pb-0">
          <CardHeader className="pr-3 pl-3">
            <div className="flex flex-row items-center justify-between">
              <CardTitle className="flex flex-row items-center gap-2">
                <div
                  className="cursor-grab rounded-md p-2 hover:bg-muted"
                  {...attributes}
                  {...listeners}
                >
                  <GripVerticalIcon
                    className="text-muted-foreground"
                    size={16}
                  />
                </div>
                <div>{product.name}</div>
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="z-20" size="icon" variant="outline">
                    <EllipsisVerticalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={onRemove}>
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="mt-3 divide-y divide-border border-border border-t py-6">
            <FormField
              control={form.control}
              name={'displayName'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="mt-2"
                      onChange={(e) => {
                        handleOnUpdate({
                          displayName: e.target.value
                        });
                      }}
                      placeholder="Example: Monthly subscription"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardContent className="divide-y divide-border border-border border-t px-0 py-0">
            <div className="flex flex-row items-center justify-start space-x-4 px-6 py-4">
              <FormField
                control={form.control}
                name={'enableNativePurchase'}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-start space-x-4">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(e) => {
                          handleOnUpdate({
                            enableNativePurchase: e
                          });
                        }}
                      />
                    </FormControl>
                    <p>Native purchase</p>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardContent className="mt-0 divide-y divide-border border-border border-t px-0 py-0">
            <div className="flex flex-row items-center justify-start space-x-4 px-6 py-4">
              <div>
                <FormField
                  control={form.control}
                  name={'enableWebCheckout'}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-start space-x-4">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(e) => {
                            handleOnUpdate({
                              enableWebCheckout: e
                            });
                          }}
                        />
                      </FormControl>
                      <p>Web checkout</p>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex flex-row items-center justify-start space-x-4">
                {/* <Label className="sr-only">Payment provider</Label> */}
                {/* TODO: Make this dynamic */}
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a payment provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="paypal">Polar.sh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Form>
  );
}
