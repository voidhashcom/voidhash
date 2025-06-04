import { z } from "zod";
import {
	CreateProductEditorSheetParams,
	PaymentProviderProductEditorSheetSection,
} from "../types";

export class PaymentProviderProductConfiguration<
	TProductConfiguration,
	TProductConfigurationSchema extends z.ZodSchema,
> {
	keyProperties: string[];
	defaultProductConfiguration: TProductConfiguration;
	productConfigurationSchema: TProductConfigurationSchema;
	createProductEditorSheet: (params: CreateProductEditorSheetParams) => {
		sections: PaymentProviderProductEditorSheetSection[];
	};

	constructor(
		keyProperties: string[],
		defaultProductConfiguration: TProductConfiguration,
		productConfigurationSchema: TProductConfigurationSchema,
		createProductEditorSheet: (params: CreateProductEditorSheetParams) => {
			sections: PaymentProviderProductEditorSheetSection[];
		}
	) {
		this.keyProperties = keyProperties;
		this.defaultProductConfiguration = defaultProductConfiguration;
		this.productConfigurationSchema = productConfigurationSchema;
		this.createProductEditorSheet = createProductEditorSheet;
	}
}
