export type ProductType = 'inapp' | 'subs';

export type BaseProduct = {
  id: string;
  title: string;
  description: string;
  type: ProductType;
  displayName?: string;
  displayPrice: string;
  currency: string;
  price?: number;
};
