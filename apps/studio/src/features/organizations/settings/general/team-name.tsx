'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input
} from '@voidhash/ui';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { queryKeys } from 'src/lib/tanstack-query';
import { updateOrganizationOptions } from 'src/lib/tanstack-query/organizations';
import { z } from 'zod/v3';

const updateTeamNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name is required')
    .max(32, 'Team name must be less than 32 characters')
});

type UpdateTeamNameForm = z.infer<typeof updateTeamNameSchema>;

export function TeamNameForm({
  organization
}: {
  organization: {
    id: string;
    name: string;
  };
}) {
  const form = useForm<UpdateTeamNameForm>({
    resolver: zodResolver(updateTeamNameSchema),
    defaultValues: {
      name: organization?.name
    }
  });

  const queryClient = useQueryClient();
  const { mutate: updateTeamName, status: updateTeamNameStatus } = useMutation({
    ...updateOrganizationOptions(),
    onSuccess: () => {
      toast.success('Team name updated successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });
    },
    onError: () => {
      toast.error('Failed to update team name');
    }
  });

  const onSubmit = (data: UpdateTeamNameForm) => {
    if (!organization) {
      return;
    }
    updateTeamName({
      organizationId: organization.id,
      name: data.name
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="mt-8 overflow-hidden pb-0">
          <CardHeader>
            <CardTitle>Team name</CardTitle>
            <CardDescription>
              This is your team&apos;s visible name within Voidhash. For
              example, the name of your company or department.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      className="max-w-64 text-foreground text-sm"
                      placeholder="Enter team name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex items-baseline justify-between border-border border-t bg-background py-3 [.border-t]:pt-3">
            <div className="text-muted-foreground">
              Please use 32 characters at maximum.
            </div>
            <div>
              <Button
                disabled={updateTeamNameStatus === 'pending'}
                type="submit"
              >
                {updateTeamNameStatus === 'pending' ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
