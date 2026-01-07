import { ANONYMOUS_USER_ID_PREFIX } from "@voidhash/lib";

export const isAnonymousId = (id: string) =>
  id.startsWith(ANONYMOUS_USER_ID_PREFIX);
