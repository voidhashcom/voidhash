import {
  PaymentProviderConfigurationOperationsLive,
  PaymentProviderConfigurationService,
  PaymentProviderProductOperationsLive,
  PaymentProviderProductService,
} from "@voidhash/core-v2";
import { Layer } from "effect";

import {
  DbPurchaseManagementRepositoryLive,
  ProjectPermissionCheckLive,
  PurchaseAuditLogLive,
  SchemaCacheInvalidationLive,
} from "./DbPurchaseManagementPortsLive.ts";

export const PurchaseManagementPortsLive = Layer.mergeAll(
  DbPurchaseManagementRepositoryLive,
  ProjectPermissionCheckLive,
  PurchaseAuditLogLive,
  SchemaCacheInvalidationLive,
);

/** Provider-configuration management with core-v2 orchestration and PostgreSQL adapters. */
export const PaymentProviderConfigurationLive = PaymentProviderConfigurationService.layer.pipe(
  Layer.provide(
    PaymentProviderConfigurationOperationsLive.pipe(Layer.provide(PurchaseManagementPortsLive)),
  ),
);

/** Provider-product management with core-v2 orchestration and PostgreSQL adapters. */
export const PaymentProviderProductLive = PaymentProviderProductService.layer.pipe(
  Layer.provide(
    PaymentProviderProductOperationsLive.pipe(Layer.provide(PurchaseManagementPortsLive)),
  ),
);

export const PaymentProviderManagementLive = Layer.merge(
  PaymentProviderConfigurationLive,
  PaymentProviderProductLive,
);
