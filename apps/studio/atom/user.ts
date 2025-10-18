'use client';

import { useAtomValue } from '@effect-atom/atom-react';
import { VRpc } from './lib/rpc-client';
import { queryKeys } from './query-keys';

export const useUser = () =>
  useAtomValue(
    VRpc.query('CurrentUser', undefined, {
      reactivityKeys: queryKeys.user.getUser()
    })
  );
