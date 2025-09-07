import { Layer, pipe } from 'effect';
import { AppStoreTransactionRepository } from './repositories/app-store-transaction.repository';
import { AppStoreService } from './services/app-store.service';
import { AppStoreServerAPIService } from './services/app-store-server-api.service';

export const AppStoreProviderLayer = pipe(
  AppStoreService.Default,
  Layer.provideMerge(AppStoreServerAPIService.Default),
  Layer.provideMerge(AppStoreTransactionRepository.Default)
);
