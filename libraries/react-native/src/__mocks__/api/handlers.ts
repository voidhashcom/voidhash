// import { HttpResponse, http } from '../../../../node_modules/msw';

// export const handlers = [
//   http.post('http://localhost:3000/v1/sdk/get-configuration', () => {
//     return HttpResponse.json({
//       paywalls: [
//         {
//           paywallId: 'paywall_1',
//           paywallProducts: [
//             {
//               paywallProductId: 'pw_prod_1',
//               productId: 'prod_1',
//               displayName: 'Premium Monthly',
//               nativePaymentProviderConfigurationProductId: 'native_ppc_prod_1',
//               defaultWebCheckoutPaymentProviderConfigurationProductId:
//                 'web_ppc_prod_1',
//               paymentProviderConfigurationProducts: [
//                 // App Store
//                 {
//                   paymentProviderConfigurationProductId: 'ppc_prod_1_1',
//                   paymentProviderConfigurationId: 'ppc_1',
//                   configuration: {}
//                 },
//                 // Google Play
//                 {
//                   paymentProviderConfigurationProductId: 'ppc_prod_1_2',
//                   paymentProviderConfigurationId: 'ppc_2',
//                   configuration: {}
//                 }
//               ]
//             },
//             {
//               paywallProductId: 'pw_prod_2',
//               productId: 'prod_2',
//               displayName: 'Premium Yearly',
//               nativePaymentProviderConfigurationProductId: null,
//               defaultWebCheckoutPaymentProviderConfigurationProductId:
//                 'web_ppc_prod_2',
//               paymentProviderConfigurationProducts: [
//                 // App Store
//                 {
//                   paymentProviderConfigurationProductId: 'ppc_prod_2_1',
//                   paymentProviderConfigurationId: 'ppc_1',
//                   configuration: {}
//                 },
//                 // Google Play
//                 {
//                   paymentProviderConfigurationProductId: 'ppc_prod_2_2',
//                   paymentProviderConfigurationId: 'ppc_2',
//                   configuration: {}
//                 }
//               ]
//             }
//           ]
//         }
//       ],
//       paywallLocations: [
//         {
//           paywallLocationId: 'location_1',
//           slug: 'home'
//         },
//         {
//           paywallLocationId: 'location_2',
//           slug: 'settings'
//         }
//       ],
//       placements: [
//         {
//           paywallId: 'paywall_1',
//           paywallLocationId: 'location_1'
//         },
//         {
//           paywallId: 'paywall_1',
//           paywallLocationId: 'location_2'
//         }
//       ],
//       paymentProviderConfigurations: [
//         {
//           paymentProviderConfigurationId: 'ppc_1',
//           providerId: 'app-store'
//         },
//         {
//           paymentProviderConfigurationId: 'ppc_2',
//           providerId: 'google-play'
//         }
//       ]
//     });
//   })
// ];
