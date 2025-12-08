import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuth } from 'src/components/auth-context';
import { currentUserOptions } from '@/lib/tanstack-query';

export const Route = createFileRoute('/_authenticated/')({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(
      currentUserOptions()
    );

    const organizationToGoTo = user.organizations[0];
    if (!organizationToGoTo) {
      throw redirect({ to: '/create-organization' });
    }
    throw redirect({
      to: '/$organizationSlug',
      params: { organizationSlug: organizationToGoTo.slug }
    });
  }
});

function RouteComponent() {
  const { user } = useAuth();
  return <div>Hello {user.email}!</div>;
}
