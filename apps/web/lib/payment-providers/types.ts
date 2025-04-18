import { z } from "zod";

export type PaymentProvider = {
	id: string;
	title: string;
	defaultConfiguration: object;
	configurationSchema: z.ZodSchema;
};
