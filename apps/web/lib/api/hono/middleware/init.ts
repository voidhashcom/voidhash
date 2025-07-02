import { MiddlewareHandler } from "hono";
import { HonoEnv } from "../env";
import { generateId } from "@/lib/id/generate";
import { ConsoleLogger } from "@/lib/logger/console";
import { env } from "@/lib/env";

/**
 * workerId and coldStartAt are used to track the lifetime of the worker
 * and are set once when the worker is first initialized.
 *
 * subsequent requests will use the same workerId and coldStartAt
 */
let isolateId: string | undefined = undefined;
let isolateCreatedAt: number | undefined = undefined;
/**
 * Initialize all services.
 *
 * Call this once before any hono handlers run.
 */
export function init(): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		if (!isolateId) {
			isolateId = crypto.randomUUID();
		}
		if (!isolateCreatedAt) {
			isolateCreatedAt = Date.now();
		}
		c.set("isolateId", isolateId);
		c.set("isolateCreatedAt", isolateCreatedAt);
		const requestId = generateId("request");
		c.set("requestId", requestId);

		c.set("requestStartedAt", Date.now());

		c.res.headers.set("Voidhash-Request-Id", requestId);

		const logger = new ConsoleLogger({
			requestId,
			application: "api",
			environment: env.VERCEL_ENV ?? "unknown",
			defaultFields: { environment: env.VERCEL_ENV ?? "unknown" },
		});

		c.set("logger", logger);

		await next();
	};
}
