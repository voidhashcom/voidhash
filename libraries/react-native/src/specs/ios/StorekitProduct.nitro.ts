// Credits: A lot of this was inspired by https://github.com/hyochan/expo-iap
import type { HybridObject } from 'react-native-nitro-modules';
import type { StorekitProductSubscription } from './StorekitProductSubscription.nitro';

export interface StorekitProduct extends HybridObject<{ ios: 'swift' }> {
  readonly debugDescription?: string | null;
  readonly description: string;
  readonly displayName: string;
  readonly displayPrice: string;
  readonly id: string;
  readonly isFamilyShareable: boolean;
  readonly price: number;
  readonly subscription?: StorekitProductSubscription | null;
  readonly type: string;
  readonly currency: string;
}
