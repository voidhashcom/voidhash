'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Paywall } from '@voidhash/db';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  cn,
  InfoTooltip,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@voidhash/ui';
import { Button } from '@voidhash/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { InferSafeActionFnResult } from 'next-safe-action';
import { useAction } from 'next-safe-action/hooks';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { createPaywallLocationAction } from '@/lib/nextjs/server-actions';

const createPaywallLocationSchema = z.object({
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
      'Slug must contain only lowercase letters, numbers, underscores, and hyphens'
    ),
  defaultPaywallId: z.string().min(1, 'Default paywall is required')
});

type CreatePaywallLocationForm = z.infer<typeof createPaywallLocationSchema>;
type PaywallLocation = InferSafeActionFnResult<
  typeof createPaywallLocationAction
>['data'];

interface CreatePaywallLocationModalProps {
  open: boolean;
  onClose: () => void;
  paywalls: Paywall[];
  trigger: React.ReactNode;
  projectId: string;
  onSuccess?: (paywallLocation: PaywallLocation) => void;
}

export function CreatePaywallLocationModal({
  open,
  onClose,
  trigger,
  paywalls,
  projectId,
  onSuccess
}: CreatePaywallLocationModalProps) {
  const router = useRouter();
  const form = useForm<CreatePaywallLocationForm>({
    resolver: zodResolver(createPaywallLocationSchema),
    defaultValues: {
      name: '',
      slug: '',
      defaultPaywallId: paywalls[0]?.id || ''
    }
  });

  const { execute, isPending } = useAction(createPaywallLocationAction, {
    onSuccess: (res) => {
      if (res.data) {
        toast.success('Paywall location created successfully');
        onSuccess?.(res.data);
        router.refresh();
        handleOpenChange(false);
      }
    },
    onError: (error) => {
      toast.error(
        error.error.serverError || 'Failed to create paywall location'
      );
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreatePaywallLocationForm) => {
    execute({ ...data, projectId });
  };

  useEffect(() => {
    if (paywalls.length > 0) {
      form.setValue('defaultPaywallId', paywalls[0]?.id || '');
    }
  }, [paywalls, form]);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Paywall Location</DialogTitle>
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
                      placeholder="Onboarding, Feature X locked, etc."
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
                    <InfoTooltip
                      info={
                        'Slugs are unique identifiers used to reference the paywall location in code.'
                      }
                    />
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="onboarding, feature-x-locked, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultPaywallId"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>
                    Paywall{' '}
                    <InfoTooltip info="The paywall that will be shown on this location." />
                  </FormLabel>
                  <FormControl>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          {/** biome-ignore lint/a11y/useSemanticElements: custom component */}
                          <Button
                            className={cn(
                              'justify-between',
                              !field.value && 'text-muted-foreground'
                            )}
                            role="combobox"
                            variant="outline"
                          >
                            {field.value
                              ? paywalls.find(
                                  (paywall) => paywall.id === field.value
                                )?.name
                              : 'Select paywall'}
                            <ChevronsUpDown className="opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[300px] p-0">
                        <Command>
                          <CommandInput
                            className="h-9"
                            placeholder="Search paywall..."
                          />
                          <CommandList>
                            <CommandEmpty>No paywalls found.</CommandEmpty>
                            <CommandGroup>
                              {paywalls.map((paywall) => (
                                <CommandItem
                                  className="cursor-pointer"
                                  key={paywall.id}
                                  onSelect={() => {
                                    form.setValue(
                                      'defaultPaywallId',
                                      paywall.id
                                    );
                                  }}
                                  value={paywall.name}
                                >
                                  {paywall.name}
                                  <Check
                                    className={cn(
                                      'ml-auto',
                                      paywall.id === field.value
                                        ? 'opacity-100'
                                        : 'opacity-0'
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
                {isPending
                  ? 'Creating Paywall Location...'
                  : 'Create Paywall Location'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
