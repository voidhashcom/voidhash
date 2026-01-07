import { z } from "zod";

export const createCheckoutBodySchema = z.object({
  appUserId: z.string(),
  productId: z.string(),
});
