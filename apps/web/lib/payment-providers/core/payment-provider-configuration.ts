import { z } from "zod";
import {
	CreateConfigurationSheetParams,
	PaymentProviderConfigurationSheetSection,
} from "../types";

export class PaymentProviderConfiguration<
	TConfiguration,
	TConfigurationSchema extends z.ZodSchema,
> {
	defaultConfiguration: TConfiguration;
	configurationSchema: TConfigurationSchema;
	createConfigurationSheet: (params: CreateConfigurationSheetParams) => {
		sections: PaymentProviderConfigurationSheetSection[];
	};

	constructor(
		defaultConfiguration: TConfiguration,
		configurationSchema: TConfigurationSchema,
		createConfigurationSheet: (params: CreateConfigurationSheetParams) => {
			sections: PaymentProviderConfigurationSheetSection[];
		}
	) {
		this.defaultConfiguration = defaultConfiguration;
		this.configurationSchema = configurationSchema;
		this.createConfigurationSheet = createConfigurationSheet;
	}
}
