import type {
  AnyDefinedPerks,
  AnyDefinedProviders,
  InferProductConfigurationPerks,
  InferProductConfigurationProviders,
  ProductDefinitionConfiguration,
  ProductDefinitionConfigurePerksFn,
  ProductDefinitionConfigureProvidersFn
} from '../types';

export abstract class ProductDefinition<
  TType,
  TProductProperties extends Record<string, unknown>,
  TProductDefinitionConfiguration extends ProductDefinitionConfiguration<
    AnyDefinedProviders,
    AnyDefinedPerks
  >
  // TProductDefinitionConfiguration extends ReturnType<
  //   SubscriptionProductDefinitionConfigurationFn<TProductProperties>
  // >,
> {
  type: TType;
  slug: string;
  private _properties: TProductProperties;
  private _configuration: TProductDefinitionConfiguration;

  constructor(
    type: TType,
    slug: string,
    properties: TProductProperties,
    configuration: TProductDefinitionConfiguration
  ) {
    this.type = type;
    this.slug = slug;
    this._properties = properties;
    this._configuration = configuration;
  }

  get properties(): TProductProperties {
    return this._properties;
  }

  get configuration(): TProductDefinitionConfiguration {
    return this._configuration;
  }
}

// export class ProductPerkConfiguration<
//   TPerks extends DefinedPerks<Record<string, PerkDefinition>>,
// > {
//   private _perks: TPerks;
//   private _options: ProductPerkConfigurationOptions<TPerks>;

//   constructor(perks: TPerks, options: ProductPerkConfigurationOptions<TPerks>) {
//     this._perks = perks;
//     this._options = options;
//   }

//   get perks(): TPerks {
//     return this._perks;
//   }

//   get options(): ProductPerkConfigurationOptions<TPerks> {
//     return this._options;
//   }
// }

export function productConfigurationFactory() {
  const configureProviders: ProductDefinitionConfigureProvidersFn = (
    paymentProviders,
    configureFn
  ) => {
    const configuration = configureFn() as InferProductConfigurationProviders<
      typeof paymentProviders
    >;
    configuration._ = {
      paymentProviders
    };
    return configuration;
  };

  const configurePerks: ProductDefinitionConfigurePerksFn = (
    perks,
    configureFn
  ) => {
    const configuration = configureFn() as InferProductConfigurationPerks<
      typeof perks
    >;
    configuration._ = {
      perks
    };
    return {
      ...configuration,
      _: {
        perks
      }
    };
  };

  return {
    configureProviders,
    configurePerks
  };
}
