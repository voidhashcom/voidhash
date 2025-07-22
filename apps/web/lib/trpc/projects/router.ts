import { organization, projects } from '@voidhash/db';
import { eq } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { getTeamsProjectsBySlugSchema } from './schema';

export const projectsRouter = createTRPCRouter({
  getTeamsProjectsBySlug: protectedProcedure
    .input(getTeamsProjectsBySlugSchema)
    .query(async ({ input, ctx }) => {
      const teamProjects = await ctx.db
        .select()
        .from(projects)
        .innerJoin(organization, eq(projects.organizationId, organization.id))
        .where(eq(organization.slug, input.organizationSlug));

      return teamProjects.map((project) => project.project);
    })
});
