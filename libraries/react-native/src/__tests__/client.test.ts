import { ok } from 'neverthrow';
import type { CustomerAttributeManager } from '../core/identity/customer-attribute-manager';
import type { CustomerInfoManager } from '../core/identity/customer-info-manager';
import type { IdentityManager } from '../core/identity/identity-manager';
import type { PaymentAdapter } from '../core/payment-adapters/payment-adapter';
import {
  definePerks,
  paymentProviders,
  unlockablePerk,
  type VoidhashSchema
} from '../core/schema';
import { subscription } from '../core/schema/products/subscription';
import { createVoidhashTestClient } from '../core/testing/client';

const testProviders = paymentProviders({
  appleAppStore: true
});

const testPerks = definePerks({
  allAccess: unlockablePerk('all-access', {
    name: 'All Access'
  })
});

const schema = {
  providers: testProviders,
  perks: testPerks,
  monthlySub: subscription('monthly_sub', (s) => ({
    name: 'Monthly',
    perks: s.configurePerks(testPerks, () => ({
      allAccess: true
    })),
    providers: s.configureProviders(testProviders, () => ({
      googlePlay: {
        productId: 'com.voidhash.example.monthly'
      },
      appleAppStore: {
        productId: 'test_group_monthly'
      }
    }))
  })),
  yearlySub: subscription('yearly_sub', (s) => ({
    name: 'Yearly',
    perks: s.configurePerks(testPerks, () => ({
      allAccess: true
    })),
    providers: s.configureProviders(testProviders, () => ({
      googlePlay: {
        productId: 'com.voidhash.example.yearly',
        basePlanId: 'com.voidhash.example.yearly.base'
      },
      appleAppStore: {
        productId: 'test_group_yearly'
      }
    }))
  }))
} satisfies VoidhashSchema;

describe('VoidhashClient', () => {
  describe('init', () => {
    test('should handle initial user id', async () => {
      const initialId = 'abcd';
      const cachedUserId = 'user-123';

      const mockCustomerAttributeManager: Partial<CustomerAttributeManager> = {
        syncCustomerAttributes: jest.fn()
      };
      const mockIdentityManager: Partial<IdentityManager> = {
        identify: jest.fn(),
        getAppUserIdFromCache: jest.fn().mockResolvedValue(cachedUserId)
      };
      const mockPaymentAdapter: Partial<PaymentAdapter> = {
        initConnection: jest.fn().mockResolvedValue(ok(undefined))
      };
      const voidhashClient = createVoidhashTestClient({
        initialAppUserId: initialId,
        schema,
        customerAttributeManager:
          mockCustomerAttributeManager as CustomerAttributeManager,
        identityManager: mockIdentityManager as IdentityManager,
        paymentAdapter: mockPaymentAdapter as PaymentAdapter
      });

      await voidhashClient.init();

      expect(
        mockCustomerAttributeManager.syncCustomerAttributes
      ).toHaveBeenCalledWith(cachedUserId);
      expect(mockIdentityManager.identify).toHaveBeenCalledWith(initialId, {});
      expect(mockPaymentAdapter.initConnection).toHaveBeenCalled();
      expect(voidhashClient.isInitialized).toBe(true);
    });

    test('should handle no initial user id', async () => {
      const appUserId = 'user-456';

      const mockCustomerAttributeManager: Partial<CustomerAttributeManager> = {
        syncCustomerAttributes: jest.fn()
      };
      const mockCustomerInfoManager: Partial<CustomerInfoManager> = {
        getCustomer: jest.fn()
      };
      const mockIdentityManager: Partial<IdentityManager> = {
        getAppUserId: jest.fn().mockResolvedValue(appUserId)
      };

      const mockPaymentAdapter: Partial<PaymentAdapter> = {
        initConnection: jest.fn().mockResolvedValue(ok(undefined))
      };

      const voidhashClient = createVoidhashTestClient({
        schema,
        customerAttributeManager:
          mockCustomerAttributeManager as CustomerAttributeManager,
        customerInfoManager: mockCustomerInfoManager as CustomerInfoManager,
        identityManager: mockIdentityManager as IdentityManager,
        paymentAdapter: mockPaymentAdapter as PaymentAdapter
      });

      await voidhashClient.init();

      expect(
        mockCustomerAttributeManager.syncCustomerAttributes
      ).toHaveBeenCalledWith(appUserId);
      expect(mockCustomerInfoManager.getCustomer).toHaveBeenCalledWith(
        appUserId,
        'fetch'
      );
      expect(mockPaymentAdapter.initConnection).toHaveBeenCalled();
      expect(voidhashClient.isInitialized).toBe(true);
    });
  });

  describe('end', () => {
    test('should end payment adapter connection and set initialized to false', async () => {
      const mockPaymentAdapter: Partial<PaymentAdapter> = {
        endConnection: jest.fn().mockResolvedValue(ok(undefined))
      };
      const voidhashClient = createVoidhashTestClient({
        schema,
        paymentAdapter: mockPaymentAdapter as PaymentAdapter
      });

      // Then end
      await voidhashClient.end();

      expect(mockPaymentAdapter.endConnection).toHaveBeenCalled();
      expect(voidhashClient.isInitialized).toBe(false);
    });
  });
});
