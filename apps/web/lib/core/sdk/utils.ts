import { ANONYMOUS_USER_ID_PREFIX } from "./constants";

export const isAnonymousId = (id: string) =>
	id.startsWith(ANONYMOUS_USER_ID_PREFIX);
