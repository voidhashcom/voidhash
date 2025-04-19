import { z } from "zod";

export const errorResponseSchema = z.object({
	error: z.string(),
});
