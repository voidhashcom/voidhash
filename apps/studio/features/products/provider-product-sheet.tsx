/** biome-ignore-all lint/suspicious/noExplicitAny: any */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  Button,
  CopyText,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@voidhash/ui';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod/v3';
import { paymentProviders } from '@/lib/payment-providers/payment-providers';
import {
  createPaymentProviderProductOptions,
  updatePaymentProviderProductOptions
} from '@/lib/tanstack-query';

export function ProviderProductSheet({
  open,
  onClose,
  paymentProviderConfigurationProductId,
  productId,
  paymentProviderConfigurationId,
  providerId,
  configuration,
  mode
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  paymentProviderConfigurationId: string;
  paymentProviderConfigurationProductId?: string;
  providerId: string;
  mode: 'add' | 'edit';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configuration?: any;
}) {
  const router = useRouter();
  const paymentProvider = paymentProviders.find((pp) => pp.id === providerId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    resolver: zodResolver(
      paymentProvider?.productConfigurationSchema ?? z.object({})
    ),
    defaultValues: paymentProvider?.defaultProductConfiguration
  });

  const { mutate: create, status: createStatus } = useMutation({
    ...createPaymentProviderProductOptions(),
    onSuccess: () => {
      toast.success(
        `${paymentProvider?.title} configuration saved successfully`
      );
      onClose();
      router.refresh();
    },
    onError: () => {
      toast.error(`Failed to save ${paymentProvider?.title} configuration`);
    }
  });

  const { mutate: update, status: updateStatus } = useMutation({
    ...updatePaymentProviderProductOptions(),
    onSuccess: () => {
      toast.success(
        `${paymentProvider?.title} configuration saved successfully`
      );
      onClose();
      router.refresh();
    },
    onError: () => {
      toast.error(`Failed to save ${paymentProvider?.title} configuration`);
    }
  });

  const isPending = createStatus === 'pending' || updateStatus === 'pending';

  const onSubmit = (data: any) => {
    if (mode === 'add') {
      create({
        productId,
        paymentProviderConfigurationId,
        configuration: data
      });
    } else {
      if (!paymentProviderConfigurationProductId) {
        toast.error('An error occurred while saving the configuration');
        return;
      }
      update({
        paymentProviderConfigurationProductId,
        configuration: data
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset(
        configuration ?? paymentProvider?.defaultProductConfiguration ?? {}
      );
    }
  }, [open, configuration, form, paymentProvider]);

  if (!paymentProvider) {
    return null;
  }

  const configurationSheet = paymentProvider.getProductConfigurationSheet({
    productId
  });

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={open}
    >
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {mode === 'add'
              ? `Add ${paymentProvider.title} Product`
              : `Edit ${paymentProvider.title} Product`}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form
            className="flex flex-1 flex-col"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div>
              {form.formState.errors.root && (
                <div className="text-destructive">
                  {form.formState.errors.root.message}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-6 px-4 ">
              {configurationSheet.sections.map((section) => (
                <Fragment key={section.key}>
                  {section.type === 'text-input' && (
                    <FormField
                      control={form.control}
                      name={section.name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{section.label}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={section.input.placeholder}
                              type={section.input.type}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {section.type === 'copy-text' && (
                    <div className="mt-4">
                      <Label>{section.label}</Label>
                      <div className="mt-2 rounded-md bg-muted p-3">
                        <CopyText text={section.text} />
                      </div>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
            <SheetFooter className="flex flex-row justify-end gap-2 border-border border-t">
              <div className="flex flex-row justify-end gap-2">
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    onClose();
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button disabled={isPending} type="submit">
                  {isPending ? 'Saving...' : mode === 'add' ? 'Add' : 'Save'}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
