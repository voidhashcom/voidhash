// import { Environment } from '@voidhash/lib';
// import { z } from 'zod';
// import { BasePaymentProvider } from '../../utils/payment-providers/base-payment-provider';
// import type { PaymentProvider } from '../../utils/payment-providers/payment-provider';

// export const appStorePaymentProviderId = 'app-store' as const;

// const appStoreGlobalConfigurationSchema = z.object({
//   issuerId: z.string().min(1, {
//     message: 'Issuer ID is required'
//   }),
//   bundleId: z.string().min(1, {
//     message: 'Bundle ID is required'
//   }),
//   keyId: z.string().min(1, {
//     message: 'Key ID is required'
//   }),
//   privateKey: z.string().min(1, {
//     message: 'Private key is required'
//   })
// });

// const appStoreProductConfigurationSchema = z.object({
//   productId: z.string().min(1, {
//     message: 'Product ID is required'
//   })
// });

// export class AppStorePaymentProvider
//   extends BasePaymentProvider<
//     typeof appStorePaymentProviderId,
//     typeof appStoreGlobalConfigurationSchema,
//     typeof appStoreProductConfigurationSchema
//   >
//   implements
//     PaymentProvider<
//       typeof appStorePaymentProviderId,
//       typeof appStoreGlobalConfigurationSchema,
//       typeof appStoreProductConfigurationSchema
//     >
// {
//   constructor() {
//     super(
//       appStorePaymentProviderId,
//       'App Store',
//       [Environment.Production],
//       ['bundleId'] as const,
//       ['productId'] as const,
//       'native'
//     );
//   }
//   getIsConfigurable(): boolean {
//     return true;
//   }
//   getDefaultGlobalConfiguration(): Partial<
//     z.infer<typeof appStoreGlobalConfigurationSchema>
//   > {
//     return {
//       issuerId: '',
//       bundleId: '',
//       keyId: '',
//       privateKey: ''
//     };
//   }
//   getGlobalConfigurationSchema(): typeof appStoreGlobalConfigurationSchema {
//     return appStoreGlobalConfigurationSchema;
//   }
//   getGlobalConfigurationSheet(): {
//     sections: PaymentProviderConfigurationSheetSection[];
//   } {}
//   getIsProductConfigurable(): boolean {
//     return true;
//   }
//   getDefaultProductConfiguration(): Partial<
//     z.infer<typeof appStoreProductConfigurationSchema>
//   > {
//     return {
//       productId: ''
//     };
//   }
//   getProductConfigurationSchema(): typeof appStoreProductConfigurationSchema {
//     return appStoreProductConfigurationSchema;
//   }
//   getProductConfigurationSheet(): {
//     sections: PaymentProviderProductEditorSheetSection[];
//   } {
//     return {
//       sections: [
//         {
//           key: 'productId',
//           type: 'text-input',
//           name: 'productId',
//           label: 'Product ID',
//           input: {
//             type: 'text',
//             placeholder: 'example_app.1_month_subscription'
//           }
//         }
//       ]
//     };
//   }

//   checkIfCorrectlyConfigured(
//     // configuration: z.infer<typeof appStoreProductConfigurationSchema>
//   ): boolean {
//     return true;
//   }
// }

// export const appStore = new AppStorePaymentProvider();
