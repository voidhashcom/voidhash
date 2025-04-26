import { ServiceContext } from "@/lib/service-function";

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
		services: ServiceContext;
		/**
		 * IP address or region information
		 */
		location: string;
		userAgent?: string;
	};
};
