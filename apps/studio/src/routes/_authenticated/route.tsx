import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Spinner } from '@voidhash/ui';
import { AuthProvider } from 'src/components/auth-context';
import { currentUserOptions } from '@/lib/tanstack-query';

export const Route = createFileRoute('/_authenticated')({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(currentUserOptions());
    } catch (error) {
      // TODO: Handle error and redirect to login
      console.log(error);
    }
  }
  // pendingComponent: () => (
  //   <div className="flex h-screen w-screen items-center justify-center">
  //     <Spinner />
  //   </div>
  // )
});

function RouteComponent() {
  const { data } = useSuspenseQuery(currentUserOptions());
  return (
    <AuthProvider user={data}>
      <Outlet />
    </AuthProvider>
  );
}
