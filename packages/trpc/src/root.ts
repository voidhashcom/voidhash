import { createTRPCRouter } from "./trpc";
import { authRouter } from "./auth/router";
import { customersRouter } from "./customers/router";
import { paymentProvidersRouter } from "./payment-providers/router";
import { projectsRouter } from "./projects/router";

export const appRouter = createTRPCRouter({
	auth: authRouter,
	customers: customersRouter,
	paymentProviders: paymentProvidersRouter,
	projects: projectsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
