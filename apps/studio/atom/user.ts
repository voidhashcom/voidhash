import { useAtomValue } from '@effect-atom/atom-react';
import { ApiClient } from './lib/api-client';
import { queryKeys } from './query-keys';

export const useUser = () =>
  useAtomValue(
    ApiClient.query('users', 'getUser', {
      reactivityKeys: queryKeys.user.getUser()
    })
  );
