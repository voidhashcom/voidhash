'use client';
import { useAtomSet } from '@effect-atom/atom-react';
import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { CreateOrganizationBody } from '@voidhash/api-spec';
import { authClient } from '@voidhash/auth/client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Logo
} from '@voidhash/ui';
import { ApiClient } from 'atom/lib/api-client';
import { runtime } from 'atom/lib/runtime';
import { withToast } from 'atom/lib/with-toast';
import { queryKeys } from 'atom/query-keys';
import { Effect, type Schema } from 'effect';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';

type CreateOrganizationForm = Schema.Schema.Type<typeof CreateOrganizationBody>;

export default function CreateOrgPage() {
  const router = useRouter();
  const [isCreatingOrganization, startCreatingOrganization] = useTransition();

  const form = useForm<CreateOrganizationForm>({
    resolver: effectTsResolver(CreateOrganizationBody),
    defaultValues: {
      name: ''
    }
  });

  const createOrganization = useAtomSet(
    runtime.fn(
      Effect.fnUntraced(
        function* (payload: CreateOrganizationBody) {
          const apiClient = yield* ApiClient;
          return yield* apiClient.organizations.createOrganization({ payload });
        },
        withToast({
          onSuccess: 'Organization created successfully',
          onFailure: 'Failed to create organization',
          onWaiting: 'Creating organization...'
        })
      ),
      {
        reactivityKeys: queryKeys.invalidateAll()
      }
    )
  );

  const onSubmit = (data: CreateOrganizationForm) => {
    startCreatingOrganization(() => {
      createOrganization({
        name: data.name
      });
    });
  };

  // Sign out
  const signOut = async () => {
    await authClient.signOut();
    router.refresh();
    router.push('/');
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          <Card className="mt-4 text-center">
            <CardHeader>
              <CardTitle className="text-2xl">Welcome to Voidhash</CardTitle>
              <CardDescription>
                Let&apos;s start by creating your new team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  className="space-y-6"
                  onSubmit={form.handleSubmit(onSubmit)}
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Inc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    className="w-full"
                    disabled={isCreatingOrganization}
                    type="submit"
                  >
                    {isCreatingOrganization
                      ? 'Creating Organization...'
                      : 'Create Organization'}
                  </Button>
                </form>
              </Form>
              <div className="mt-6 text-muted-foreground text-sm">
                <p>
                  Already have an organization? Ask your organization
                  administrator to invite you using your email address.
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="text-center text-muted-foreground text-sm">
            Signed in to a wrong account?{' '}
            <button
              className="cursor-pointer text-foreground underline underline-offset-4"
              onClick={signOut}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
