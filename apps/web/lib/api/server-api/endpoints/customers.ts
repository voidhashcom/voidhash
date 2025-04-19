import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { nanoid } from "nanoid";
import { CookieOptions } from "hono/utils/cookie";
import { getCookie, setCookie } from "hono/cookie";

const SESSION_COOKIE_NAME = "vh_session";
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

const identifyBodySchema = z.object({
	email: z.string().email(),
	name: z.string(),
});

const identifyResponseSchema = z.object({
	customerId: z.string(),
	name: z.string(),
	email: z.string(),
});

const cookieOptions: CookieOptions = {
	httpOnly: true,
	secure: true,
	sameSite: "Strict",
	maxAge: SESSION_DURATION,
};

const app = new Hono()
	.post(
		"/init",
		describeRoute({
			description:
				"Initialize a customer session. This will create a new anonymous customer with a session id.",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": { schema: resolver(identifyResponseSchema) },
					},
				},
			},
		}),
		async (c) => {
			// Generate a new session ID
			const sessionId = nanoid();

			// Placeholder: Create anonymous session in database
			const anonymousCustomer = {
				customerId: sessionId,
				name: "Anonymous",
				email: `anonymous-${sessionId}@placeholder.com`,
				isAnonymous: true,
				createdAt: new Date(),
			};

			// Set session cookie
			setCookie(c, SESSION_COOKIE_NAME, sessionId, cookieOptions);

			return c.json(anonymousCustomer);
		}
	)

	.post(
		"/identify",
		describeRoute({
			description:
				"Identify a customer. This will link the customer to the anonymous session and create a new permanent customer.",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": { schema: resolver(identifyResponseSchema) },
					},
				},
			},
		}),
		zValidator("json", identifyBodySchema),
		async (c) => {
			const body = await c.req.json();
			const sessionId = getCookie(c, SESSION_COOKIE_NAME);

			if (!sessionId) {
				return c.json({ error: "No session found" }, 401);
			}

			// Placeholder: Find or create customer by email
			const customer = {
				customerId: nanoid(),
				name: body.name,
				email: body.email,
				isAnonymous: false,
				createdAt: new Date(),
			};

			// Placeholder: Merge anonymous session data with customer
			// This would typically involve:
			// 1. Finding all data associated with sessionId
			// 2. Updating it to be associated with the customer
			// 3. Marking the anonymous session as converted

			// Update session cookie to contain the real customer ID
			setCookie(c, SESSION_COOKIE_NAME, customer.customerId, cookieOptions);

			return c.json(customer);
		}
	);

export default app;
