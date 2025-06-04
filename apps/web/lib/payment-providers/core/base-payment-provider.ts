import { Environment } from "@voidhash/lib/constants";

export class BasePaymentProvider<TKey extends string> {
	private _id: TKey;
	private _title: string;
	private _environments: Environment[];
	// Configuration is optional for payment providers that don't require configuration - e.g. Dev Checkout

	constructor(id: TKey, title: string, environments: Environment[]) {
		this._id = id;
		this._title = title;
		this._environments = environments;
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

	// public isCorrectlyConfigured(configuration: TConfiguration) {
	// 	if (!this.configuration) {
	// 		return true;
	// 	}
	// 	const configurationSchema = this.configuration.configurationSchema;
	// 	const parsedConfiguration = configurationSchema.safeParse(configuration);
	// 	return parsedConfiguration.success;
	// }
}
