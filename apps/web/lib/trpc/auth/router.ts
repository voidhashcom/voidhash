import { auth } from '@voidhash/auth';
import { createTRPCRouter, publicProcedure } from '@/lib/trpc/trpc';

export const authRouter = createTRPCRouter({
  me: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({
      headers: ctx.headers
    });

    if (!session?.user) {
      return null;
    }

    const organizations = await auth.api.listOrganizations({
      headers: ctx.headers
    });

    return {
      ...session.user,
      organizations
    };
  })
});
