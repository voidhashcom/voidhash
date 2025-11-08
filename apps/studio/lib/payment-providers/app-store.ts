import { z } from 'zod/v3';
import { AppleLogo } from '@/features/projects/settings/payment-providers/logos/apple-logo';
import { createPaymentProvider } from './core';
import type {
  PaymentProviderConfigurationSheetSection,
  PaymentProviderProductEditorSheetSection
} from './types';

const appStoreGlobalConfigurationSchema = z.object({
  issuerId: z.string().min(1, {
    message: 'Issuer ID is required'
  }),
  bundleId: z.string().min(1, {
    message: 'Bundle ID is required'
  }),
  keyId: z.string().min(1, {
    message: 'Key ID is required'
  }),
  privateKey: z.string().min(1, {
    message: 'Private key is required'
  })
});

const appStoreProductConfigurationSchema = z.object({
  productId: z.string().min(1, {
    message: 'Product ID is required'
  })
});

export const appleAppStore = createPaymentProvider({
  id: 'apple-app-store',
  title: 'Apple App Store',
  type: 'native',
  logo: AppleLogo,
  globalConfigurationSchema: appStoreGlobalConfigurationSchema,
  productConfigurationSchema: appStoreProductConfigurationSchema,
  defaultGlobalConfiguration: {
    issuerId: '',
    bundleId: '',
    keyId: '',
    privateKey: ''
  },
  getGlobalConfigurationSheet(): {
    sections: PaymentProviderConfigurationSheetSection[];
  } {
    return {
      sections: [
        {
          key: 'bundleId',
          type: 'text-input',
          name: 'bundleId',
          label: 'Bundle ID',
          input: {
            type: 'text',
            placeholder: 'com.example.app'
          }
        },
        {
          key: 'issuerId',
          type: 'text-input',
          name: 'issuerId',
          label: 'Issuer ID',
          input: {
            type: 'text',
            placeholder: '00000000-0000-0000-0000-000000000000'
          }
        },
        {
          key: 'keyId',
          type: 'text-input',
          name: 'keyId',
          label: 'Key ID',
          input: {
            type: 'text',
            placeholder: 'XXXXXXXXXX'
          }
        },
        {
          key: 'privateKey',
          name: 'privateKey',
          type: 'p8-upload',
          label: 'Private Key (.p8 file)',
          successMessage: 'Private key was successfully attached'
        }
      ]
    };
  },
  productConfigurationKeyProperties: ['productId'],
  defaultProductConfiguration: {
    productId: ''
  },
  getProductConfigurationSheet(): {
    sections: PaymentProviderProductEditorSheetSection[];
  } {
    return {
      sections: [
        {
          key: 'productId',
          type: 'text-input',
          name: 'productId',
          label: 'Product ID',
          input: {
            type: 'text',
            placeholder: 'example_app.1_month_subscription'
          }
        }
      ]
    };
  }
});
