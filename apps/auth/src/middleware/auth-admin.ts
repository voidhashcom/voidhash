import { redirect } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '../lib/auth';

export const authAdminMiddleware = createMiddleware().server(
  async ({ next }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session) {
      throw redirect({ to: '/login' });
    }

    // Check if user has admin permissions
    const hasAdminRole = session.user.role === 'admin';

    if (!hasAdminRole) {
      throw redirect({
        to: '/login',
        search: {
          error: 'insufficient_permissions'
        }
      });
    }

    return await next();
  }
);
