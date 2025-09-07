import type { EnvironmentValue } from '@voidhash/lib/constants';
import type { z } from 'zod';

export class BasePaymentProvider<
  TKey extends string,
  TGlobalConfigurationSchema extends z.ZodSchema,
  TProductConfigurationSchema extends z.ZodSchema
> {
  private _id: TKey;
  private _title: string;
  private _environments: EnvironmentValue[];
  private _globalConfigurationKeyProperties: (keyof z.infer<TGlobalConfigurationSchema>)[];
  private _productKeyProperties: (keyof z.infer<TProductConfigurationSchema>)[];
  private _type: 'native' | 'web-checkout';
  // Configuration is optional for payment providers that don't require configuration - e.g. Dev Checkout

  constructor(
    id: TKey,
    title: string,
    environments: EnvironmentValue[],
    globalConfigurationKeyProperties: (keyof z.infer<TGlobalConfigurationSchema>)[],
    productKeyProperties: (keyof z.infer<TProductConfigurationSchema>)[],
    type: 'native' | 'web-checkout'
  ) {
    this._id = id;
    this._title = title;
    this._environments = environments;
    this._globalConfigurationKeyProperties = globalConfigurationKeyProperties;
    this._productKeyProperties = productKeyProperties;
    this._type = type;
  }

  getId() {
    return this._id;
  }

  getTitle() {
    return this._title;
  }

  getType() {
    return this._type;
  }

  isAvailableInEnvironment(environment: EnvironmentValue) {
    return this._environments.includes(environment);
  }

  createGlobalKey(
    configuration: Partial<z.infer<TGlobalConfigurationSchema>>
  ): string {
    return this._globalConfigurationKeyProperties
      .map((key) => configuration[key])
      .join(':');
  }

  createProductKey(
    configuration: z.infer<TProductConfigurationSchema>
  ): string {
    return this._productKeyProperties
      .map((key) => configuration[key])
      .join(':');
  }

  getProductKeyProperties(): (keyof z.infer<TProductConfigurationSchema>)[] {
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
