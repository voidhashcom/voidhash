import { Atom } from '@effect-atom/atom-react';
import { Layer, Logger, LogLevel } from 'effect';
import { env } from '@/lib/env';

export const makeAtomRuntime = Atom.context({ memoMap: Atom.defaultMemoMap });
makeAtomRuntime.addGlobalLayer(
  Layer.provideMerge(
    Logger.pretty,
    Logger.minimumLogLevel(
      env.NEXT_PUBLIC_VERCEL_ENV === 'development'
        ? LogLevel.Debug
        : LogLevel.Info
    )
  )
);
