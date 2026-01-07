import { ok } from "neverthrow";

import type { CustomerAttributeManager } from "../core/identity/customer-attribute-manager";
import type { CustomerInfoManager } from "../core/identity/customer-info-manager";
import type { IdentityManager } from "../core/identity/identity-manager";
import type { PaymentAdapter } from "../core/payment-adapters/payment-adapter";
import {
  type VoidhashSchema,
  definePerks,
  paymentProviders,
  unlockablePerk,
} from "../core/schema";
import { subscription } from "../core/schema/products/subscription";
import { createVoidhashTestClient } from "../core/testing/client";

const testProviders = paymentProviders({
  appleAppStore: true,
});

const testPerks = definePerks({
  allAccess: unlockablePerk("all-access", {
    name: "All Access",
  }),
});

const schema = {
  monthlySub: subscription("monthly_sub", (s) => ({
    name: "Monthly",
    perks: s.configurePerks(testPerks, () => ({
      allAccess: true,
    })),
    providers: s.configureProviders(testProviders, () => ({
      appleAppStore: {
        productId: "test_group_monthly",
      },
      googlePlay: {
        productId: "com.voidhash.example.monthly",
      },
    })),
  })),
  perks: testPerks,
  providers: testProviders,
  yearlySub: subscription("yearly_sub", (s) => ({
    name: "Yearly",
    perks: s.configurePerks(testPerks, () => ({
      allAccess: true,
    })),
    providers: s.configureProviders(testProviders, () => ({
      appleAppStore: {
        productId: "test_group_yearly",
      },
      googlePlay: {
        basePlanId: "com.voidhash.example.yearly.base",
        productId: "com.voidhash.example.yearly",
      },
    })),
  })),
} satisfies VoidhashSchema;

describe("voidhashClient", () => {
  describe("init", () => {
    it("should handle initial user id", async () => {
      const initialId = "abcd";
      const cachedUserId = "user-123";

      const mockCustomerAttributeManager: Partial<CustomerAttributeManager> = {
        syncCustomerAttributes: jest.fn(),
      };
      const mockIdentityManager: Partial<IdentityManager> = {
        getAppUserIdFromCache: jest.fn().mockResolvedValue(cachedUserId),
        identify: jest.fn(),
      };
      const mockPaymentAdapter: Partial<PaymentAdapter> = {
        initConnection: jest.fn().mockResolvedValue(ok()),
      };
      const voidhashClient = createVoidhashTestClient({
        customerAttributeManager:
          mockCustomerAttributeManager as CustomerAttributeManager,
        identityManager: mockIdentityManager as IdentityManager,
        initialAppUserId: initialId,
        paymentAdapter: mockPaymentAdapter as PaymentAdapter,
        schema,
      });

      await voidhashClient.init();

      expect(
        mockCustomerAttributeManager.syncCustomerAttributes
      ).toHaveBeenCalledWith(cachedUserId);
      expect(mockIdentityManager.identify).toHaveBeenCalledWith(initialId, {});
      expect(mockPaymentAdapter.initConnection).toHaveBeenCalledWith();
      expect(voidhashClient.isInitialized).toBeTruthy();
    });

    it("should handle no initial user id", async () => {
      const appUserId = "user-456";

      const mockCustomerAttributeManager: Partial<CustomerAttributeManager> = {
        syncCustomerAttributes: jest.fn(),
      };
      const mockCustomerInfoManager: Partial<CustomerInfoManager> = {
        getCustomer: jest.fn(),
      };
      const mockIdentityManager: Partial<IdentityManager> = {
        getAppUserId: jest.fn().mockResolvedValue(appUserId),
      };

      const mockPaymentAdapter: Partial<PaymentAdapter> = {
        initConnection: jest.fn().mockResolvedValue(ok()),
      };

      const voidhashClient = createVoidhashTestClient({
        customerAttributeManager:
          mockCustomerAttributeManager as CustomerAttributeManager,
        customerInfoManager: mockCustomerInfoManager as CustomerInfoManager,
        identityManager: mockIdentityManager as IdentityManager,
        paymentAdapter: mockPaymentAdapter as PaymentAdapter,
        schema,
      });

      await voidhashClient.init();

      expect(
        mockCustomerAttributeManager.syncCustomerAttributes
      ).toHaveBeenCalledWith(appUserId);
      expect(mockCustomerInfoManager.getCustomer).toHaveBeenCalledWith(
        appUserId,
        "fetch"
      );
      expect(mockPaymentAdapter.initConnection).toHaveBeenCalledWith();
      expect(voidhashClient.isInitialized).toBeTruthy();
    });
  });

  describe("end", () => {
    it("should end payment adapter connection and set initialized to false", async () => {
      const mockPaymentAdapter: Partial<PaymentAdapter> = {
        endConnection: jest.fn().mockResolvedValue(ok()),
      };
      const voidhashClient = createVoidhashTestClient({
        paymentAdapter: mockPaymentAdapter as PaymentAdapter,
        schema,
      });

      // Then end
      await voidhashClient.end();

      expect(mockPaymentAdapter.endConnection).toHaveBeenCalledWith();
      expect(voidhashClient.isInitialized).toBeFalsy();
    });
  });
});
