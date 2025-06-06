import { Environment } from "@voidhash/lib/constants";
import { z } from "zod";

export class BasePaymentProvider<
	TKey extends string,
	TProductConfigurationSchema extends z.ZodSchema,
> {
	private _id: TKey;
	private _title: string;
	private _environments: Environment[];
	private _productKeyProperties: (keyof z.infer<TProductConfigurationSchema>)[];
	// Configuration is optional for payment providers that don't require configuration - e.g. Dev Checkout

	constructor(
		id: TKey,
		title: string,
		environments: Environment[],
		productKeyProperties: (keyof z.infer<TProductConfigurationSchema>)[]
	) {
		this._id = id;
		this._title = title;
		this._environments = environments;
		this._productKeyProperties = productKeyProperties;
	}

	public getId() {
		return this._id;
	}

	public getTitle() {
		return this._title;
	}

	public isAvailableInEnvironment(environment: Environment) {
		return this._environments.includes(environment);
	}

	public createProductKey(
		configuration: z.infer<TProductConfigurationSchema>
	): string {
		return this._productKeyProperties
			.map((key) => configuration[key])
			.join(":");
	}

	public getProductKeyProperties(): (keyof z.infer<TProductConfigurationSchema>)[] {
		return this._productKeyProperties;
	}

	// public isCorrectlyConfigured(configuration: TConfiguration) {
	// 	if (!this.configuration) {
	// 		return true;
	// 	}
	// 	const configurationSchema = this.configuration.configurationSchema;
	// 	const parsedConfiguration = configurationSchema.safeParse(configuration);
	// 	return parsedConfiguration.success;
	// }
}
