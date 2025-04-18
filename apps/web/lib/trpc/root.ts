import { createTRPCRouter } from "./trpc";
import { authRouter } from "./auth/router";
import { projectsRouter } from "./projects/router";

export const appRouter = createTRPCRouter({
	auth: authRouter,
	projects: projectsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
