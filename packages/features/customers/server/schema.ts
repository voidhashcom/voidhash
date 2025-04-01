import { z } from "zod";

export const getCustomersSchema = z.object({
	projectId: z.string(),
});
