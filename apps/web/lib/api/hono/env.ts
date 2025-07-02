import { Logger } from "@/lib/logger/types";

export type HonoEnv = {
	Variables: {
		isolateId: string;
		isolateCreatedAt: number;
		requestId: string;
		requestStartedAt: number;
		workspaceId?: string;
		metricsContext: {
			keyId?: string;
			[key: string]: unknown;
		};
		logger: Logger;
		/**
		 * IP address or region information
		 */
		location: string;
		userAgent?: string;
	};
};
