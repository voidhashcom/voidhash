import { Effect } from 'effect';
import { headers as nextHeaders } from 'next/headers';

export const headers = Effect.promise(async () => await nextHeaders());
