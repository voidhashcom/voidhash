import { Environment } from "@voidhash/lib/constants";
import {
	PaymentProviderConfigurationSheetSection,
	PaymentProviderProductEditorSheetSection,
} from "./types";
import { z } from "zod";

export interface PaymentProvider<
	TKey extends string,
	TGlobalConfigurationSchema extends z.ZodSchema,
	TProductConfigurationSchema extends z.ZodSchema,
> {
	getId(): TKey;
	getTitle(): string;
	isAvailableInEnvironment(environment: Environment): boolean;
	getType(): "native" | "web-checkout";

	// Global configuration
	getIsConfigurable(): boolean; // This is true for almost all payment providers, except for Dev Checkout
	getDefaultGlobalConfiguration(): Partial<z.infer<TGlobalConfigurationSchema>>;
	getGlobalConfigurationSchema(): TGlobalConfigurationSchema;
	getGlobalConfigurationSheet({ projectId }: { projectId: string }): {
		sections: PaymentProviderConfigurationSheetSection[];
	};

	// Product configuration
	getIsProductConfigurable(): boolean; // This is true for almost all payment providers, except for Dev Checkout
	getDefaultProductConfiguration(): Partial<
		z.infer<TProductConfigurationSchema>
	>;
	getProductConfigurationSchema(): TProductConfigurationSchema;
	getProductConfigurationSheet({ projectId }: { projectId: string }): {
		sections: PaymentProviderProductEditorSheetSection[];
	};
	getProductKeyProperties(): string[];
	createProductKey(configuration: z.infer<TProductConfigurationSchema>): string;
	checkIfCorrectlyConfigured(
		configuration: z.infer<TProductConfigurationSchema>
	): boolean;

	// Configuration is optional for payment providers that don't require configuration - e.g. Dev Checkout
	// configuration: PaymentProviderConfiguration<
	// 	TConfiguration,
	// 	TConfigurationSchema
	// > | null;
	// products: PaymentProviderConfigurationProduct<
	// 	TProductConfiguration,
	// 	TProductConfigurationSchema
	// >;

	// keyProperties: string[];
	// defaultProductConfiguration: TProductConfiguration;
	// productConfigurationSchema: TProductConfigurationSchema;
	// createProductEditorSheet: (params: CreateProductEditorSheetParams) => {
	// 	sections: PaymentProviderProductEditorSheetSection[];
	// };
}
