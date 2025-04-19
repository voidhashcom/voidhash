import { VoidhashError } from "@voidhash/lib/constants";
import { Context } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";

export const useServiceFunction = async <T,>(
	c: Context,
	fn: () => Promise<T>
) => {
	try {
		const result = await fn();
		return c.json(result);
	} catch (error) {
		if (error instanceof VoidhashError) {
			return c.json(
				{ error: error.message },
				error.code as ContentfulStatusCode
			);
		}
		return c.json({ error: "Internal server error" }, 500);
	}
};
