import type { HybridObject } from 'react-native-nitro-modules';

export interface GoogleBillingAcknowledgeResult
  extends HybridObject<{ android: 'kotlin' }> {
  readonly responseCode: number;
  readonly debugMessage?: string;
  readonly code: string;
  readonly message: string;
}
