import { z } from "zod";

export type PaymentProvider = {
	id: string;
	title: string;
	logo: React.ComponentType<{ className?: string }>;
	configurationSchema: z.ZodSchema;
};
