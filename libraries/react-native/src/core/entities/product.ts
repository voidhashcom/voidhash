export class Product {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly displayName: string;
  readonly displayPrice: string;
  readonly price: number;
  readonly currency: string;
  readonly type: string;
  readonly platform: "ios" | "android";
  readonly googlePlayOfferToken?: string;
  readonly providerProductId?: string;

  constructor(
    id: string,
    slug: string,
    name: string,
    description: string,
    displayName: string,
    displayPrice: string,
    price: number,
    currency: string,
    type: string,
    platform: "ios" | "android",
    options?: { googlePlayOfferToken?: string; providerProductId?: string },
  ) {
    this.id = id;
    this.slug = slug;
    this.name = name;
    this.description = description;
    this.displayName = displayName;
    this.displayPrice = displayPrice;
    this.price = price;
    this.currency = currency;
    this.type = type;
    this.platform = platform;
    this.googlePlayOfferToken = options?.googlePlayOfferToken;
    this.providerProductId = options?.providerProductId;
  }
}

export class SubscriptionProduct extends Product {
  readonly interval: string;

  constructor(
    id: string,
    slug: string,
    name: string,
    description: string,
    displayName: string,
    displayPrice: string,
    price: number,
    currency: string,
    type: string,
    platform: "ios" | "android",
    interval: string,
    options?: { googlePlayOfferToken?: string; providerProductId?: string },
  ) {
    super(
      id,
      slug,
      name,
      description,
      displayName,
      displayPrice,
      price,
      currency,
      type,
      platform,
      options,
    );
    this.interval = interval;
  }
}
