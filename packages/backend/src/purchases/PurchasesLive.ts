import { FxRates, PurchaseLedgerWorker, PurchaseProcessor, PurchaseQuery } from "@voidhash/core-v2";
import * as Layer from "effect/Layer";
import { DbPurchaseStateStoreLive } from "./adapters/DbPurchaseStateStore.ts";
import { DbPurchaseLedgerStoreLive } from "./adapters/DbPurchaseLedgerStoreLive.ts";
import { PurchaseQueryPortsLive } from "./adapters/DbPurchaseQueryStoreLive.ts";
import { DbFxRateStoreLive } from "./adapters/DbFxRateStoreLive.ts";
import {
  ExchangeRateSourceLive,
  type ExchangeRateSourceConfig,
} from "./adapters/ExchangeRateSourceLive.ts";

export { DbPurchaseLedgerStoreLive } from "./adapters/DbPurchaseLedgerStoreLive.ts";
export { DbPurchaseStateStoreLive } from "./adapters/DbPurchaseStateStore.ts";
export { DbFxRateStoreLive } from "./adapters/DbFxRateStoreLive.ts";
export {
  ExchangeRateSourceLive,
  type ExchangeRateSourceConfig,
} from "./adapters/ExchangeRateSourceLive.ts";
export {
  PaymentProviderConfigurationLive,
  PaymentProviderManagementLive,
  PaymentProviderProductLive,
} from "./adapters/DbPaymentProviderManagementLive.ts";
export {
  DbPurchaseQueryStoreLive,
  PurchaseAuthorizerLive,
  PurchaseQueryPortsLive,
} from "./adapters/DbPurchaseQueryStoreLive.ts";

/** Purchase application service backed by the transactional PostgreSQL projection. */
export const PurchaseProcessingLive = PurchaseProcessor.layer.pipe(
  Layer.provide(DbPurchaseStateStoreLive),
);

export const PurchaseLedgerLive = PurchaseLedgerWorker.layer.pipe(
  Layer.provide(DbPurchaseLedgerStoreLive),
);

/** Schema-validated, authorized purchase query application. */
export const PurchaseQueryLive = PurchaseQuery.layer.pipe(Layer.provide(PurchaseQueryPortsLive));

/** Complete FX service backed by PostgreSQL and ExchangeRate-API. */
export const makeFxRatesLive = (config: ExchangeRateSourceConfig) =>
  FxRates.layer.pipe(
    Layer.provide(DbFxRateStoreLive),
    Layer.provide(ExchangeRateSourceLive(config)),
  );
