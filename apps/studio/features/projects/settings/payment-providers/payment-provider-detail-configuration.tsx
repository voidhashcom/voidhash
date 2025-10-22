'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { PaymentProviderConfiguration } from '@voidhash/rpc';
import {
  Badge,
  Button,
  Card,
  CopyText,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Dropzone,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  useConfirmDialog
} from '@voidhash/ui';
import { CheckCircleIcon, EllipsisVerticalIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { type SubmitErrorHandler, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { paymentProviders } from '@/lib/payment-providers/payment-providers';
import {
  deletePaymentProviderConfigurationOptions,
  updatePaymentProviderConfigurationOptions
} from '@/lib/tanstack-query';
import { PaymentProviderLogo } from './payment-provider-logo';

export function PaymentProviderDetailConfiguration({
  organizationSlug,
  projectSlug,
  project,
  paymentProviderConfiguration
}: {
  organizationSlug: string;
  projectSlug: string;
  project: { id: string };
  paymentProviderConfiguration: typeof PaymentProviderConfiguration.Type;
}) {
  const router = useRouter();

  const paymentProvider =
    paymentProviders.find(
      (pp) => pp.id === paymentProviderConfiguration.providerId
      // biome-ignore lint/style/noNonNullAssertion: paymentProviders is not empty
    ) ?? paymentProviders[0]!;

  const [name, setName] = useState(paymentProviderConfiguration.name);

  // biome-ignore lint/suspicious/noExplicitAny: zod
  const form = useForm<any>({
    resolver: zodResolver(paymentProvider?.globalConfigurationSchema),
    defaultValues: paymentProviderConfiguration.configuration
  });

  const { mutate: updateConfiguration, status: updateStatus } = useMutation({
    ...updatePaymentProviderConfigurationOptions(),
    onSuccess: () => {
      toast.success(
        `${paymentProvider?.title} configuration saved successfully`
      );
      router.refresh();
    },
    onError: () => {
      toast.error(`Failed to save ${paymentProvider?.title} configuration`);
    }
  });

  // Delete payment provider configuration
  const { ConfirmationDialog, openDialog } = useConfirmDialog();
  const { mutate: deleteConfiguration, status: deleteStatus } = useMutation({
    ...deletePaymentProviderConfigurationOptions(),
    onSuccess: () => {
      toast.success(
        `${paymentProvider?.title} configuration deleted successfully`
      );
      router.push(
        `/${organizationSlug}/${projectSlug}/settings/payment-providers`
      );
    },
    onError: () => {
      toast.error(`Failed to delete ${paymentProvider?.title} configuration`);
    }
  });

  const isPending = updateStatus === 'pending';
  const isDeleting = deleteStatus === 'pending';

  const handleDeletePaymentProviderConfiguration = async (id: string) => {
    const res = await openDialog({
      title: 'Delete payment provider',
      description: 'Are you sure you want to delete this payment provider?'
    });

    if (!res) {
      return;
    }

    deleteConfiguration({
      paymentProviderConfigurationId: id
    });
  };

  const onValidSubmit = (
    data: z.infer<typeof paymentProvider.globalConfigurationSchema>
  ) => {
    updateConfiguration({
      id: paymentProviderConfiguration.id,
      enabled: paymentProviderConfiguration.enabled,
      name,
      configuration: data
    });
  };

  const onInvalidSubmit: SubmitErrorHandler<
    z.infer<typeof paymentProvider.globalConfigurationSchema>
  > = (errors) => {
    // Log validation errors for debugging
    // biome-ignore lint/suspicious/noConsole: error handling
    console.error('Form validation errors:', errors);
  };

  if (!paymentProvider) {
    return null;
  }

  if (!project) {
    return null;
  }

  const configurationSheet = paymentProvider.getGlobalConfigurationSheet({
    projectId: project.id
  });

  const handleP8FileChange = (name: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      form.setValue(name, content);
    };
    reader.readAsText(file);
  };

  const handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void> = async (
    e
  ) => {
    e?.preventDefault();

    const isValid = await form.trigger();
    const isCurrentlyEnabled = paymentProviderConfiguration.enabled;

    // Case 1: Form is invalid and provider is currently enabled
    if (!isValid && isCurrentlyEnabled) {
      const shouldContinue = await openDialog({
        title: 'Invalid Configuration',
        description:
          'The current configuration is invalid. If you continue, the payment provider will be disabled. Do you want to proceed?'
      });

      if (!shouldContinue) {
        return;
      }

      // Submit with enabled set to false
      await form.handleSubmit((data) =>
        updateConfiguration({
          id: paymentProviderConfiguration.id,
          enabled: false,
          name,
          configuration: data
        })
      )(e);
      return;
    }

    // Case 2: Form is valid and provider is currently disabled
    if (isValid && !isCurrentlyEnabled) {
      const shouldEnable = (await openDialog({
        title: 'Enable Payment Provider',
        description: 'Would you like to enable this payment provider?'
      })) as boolean;

      // Submit with enabled based on user choice
      await form.handleSubmit((data) =>
        updateConfiguration({
          id: paymentProviderConfiguration.id,
          enabled: shouldEnable,
          name,
          configuration: data
        })
      )(e);
      return;
    }

    await form.handleSubmit(onValidSubmit, onInvalidSubmit)(e);
  };

  return (
    <Form {...form}>
      <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
        <div className="border-border border-b">
          <div className="mx-auto max-w-5xl pb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <PaymentProviderLogo
                  className="h-8 w-8"
                  providerId={paymentProviderConfiguration.providerId}
                />
                <h1 className="font-normal text-3xl tracking-right">
                  {paymentProviderConfiguration.name}
                </h1>
                {paymentProviderConfiguration.enabled ? (
                  <Badge variant="default">Enabled</Badge>
                ) : (
                  <Badge variant="outline">Disabled</Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <Button disabled={isPending} type="submit">
                  {isPending ? 'Saving...' : 'Save changes'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="z-20" size="icon" variant="outline">
                      <EllipsisVerticalIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      disabled={isDeleting}
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeletePaymentProviderConfiguration(
                          paymentProviderConfiguration.id
                        );
                      }}
                      variant="destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* <Alert variant="success" className="mt-6 flex items-center">
							<div className="flex-1">
								<AlertTitle>This provider is correctly configured</AlertTitle>
								<AlertDescription>
									You can enable it to start tracking payments.
								</AlertDescription>
							</div>
							<Button variant="success">Enable</Button>
						</Alert> */}
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-12 gap-6">
          <div className="col-span-6" />
          <div className="col-span-6 border-border border-r border-l bg-card">
            <div className="border-border px-4 pt-10">
              <h2 className="font-semibold text-lg tracking-tight">
                Configuration
              </h2>
            </div>
            <div className="w-full pt-6">
              <div className="flex flex-1 flex-col">
                <div>
                  {form.formState.errors.root && (
                    <div className="text-destructive">
                      {form.formState.errors.root.message}
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-6 px-4 ">
                  {paymentProvider.type === 'native' && (
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        className="mt-2"
                        id="name"
                        onChange={(e) => setName(e.target.value)}
                        value={name}
                      />
                    </div>
                  )}

                  {configurationSheet?.sections.map((section) => (
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
                          <div className="mt-2 rounded-md border border-input bg-muted p-3 font-mono text-foreground">
                            <CopyText text={section.text} />
                          </div>
                        </div>
                      )}
                      {section.type === 'p8-upload' && (
                        <FormField
                          control={form.control}
                          name="privateKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Private Key (.p8 file)</FormLabel>
                              <FormControl>
                                {field.value ? (
                                  <Card className="flex flex-row items-center justify-between gap-2 p-4">
                                    <div className="flex items-center gap-2">
                                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                                      <p className="text-muted-foreground text-sm">
                                        Private key was successfully attached
                                      </p>
                                    </div>
                                    <Button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        field.onChange('');
                                      }}
                                      variant="outline"
                                    >
                                      <XIcon className="h-4 w-4" />
                                      <span>Remove</span>
                                    </Button>
                                  </Card>
                                ) : (
                                  <Dropzone
                                    accept=".p8"
                                    maxSize={1024 * 1024}
                                    onFileChange={(file) =>
                                      handleP8FileChange(section.name, file)
                                    } // 1MB
                                  />
                                )}
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConfirmationDialog />
      </form>
    </Form>
  );
}
