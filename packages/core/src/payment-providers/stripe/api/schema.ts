import { z } from 'zod';

export const createCheckoutBodySchema = z.object({
  productId: z.string(),
  appUserId: z.string()
});
