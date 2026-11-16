import { createVoidhashSdk, type VoidhashNodeClient } from "@voidhash/node";

import type { AppConfig } from "./config";

/** A person as the API returns it: who the user is, not what they bought. */
export type VoidhashPerson = Awaited<
  ReturnType<VoidhashNodeClient["persons"]["list"]>
>["data"][number];

/**
 * Raised when Voidhash could not answer and we have nothing cached. It is not a
 * denial — the router turns it into a 503, never a 402.
 */
export class VoidhashUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "VoidhashUnavailableError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Builds the Promise client. `createVoidhashSdk` validates eagerly, so a blank
 * secret key or a malformed base URL throws here at boot instead of on the
 * first request. It makes no request itself: the key's project is read on the
 * first call that needs it.
 */
export const createVoidhashClient = (config: AppConfig): VoidhashNodeClient =>
  createVoidhashSdk({
    baseUrl: config.baseUrl,
    ingestUrl: config.ingestUrl,
    secretKey: config.secretKey,
  });

/**
 * The API's error envelope on a rejected call: `type` says what kind of
 * failure it is, `code` which one, e.g. `not_found` / `person_not_found`.
 * `undefined` for transport failures, which carry no decoded body.
 */
export const apiErrorOf = (error: unknown): { type?: string; code?: string } | undefined =>
  (error as { data?: { error?: { type?: string; code?: string } } } | null)?.data?.error;

/**
 * What a rejected Voidhash call means for the caller:
 *
 * - `person_not_found` — a definitive answer. This user has bought nothing.
 * - `misconfigured` — our secret key is wrong. Our bug, not the user's.
 * - `unknown` — 5xx or a transport failure. No information either way.
 *
 * Only `person_not_found` is safe to treat as "no access"; the other two must
 * never revoke a paying customer.
 */
export type VoidhashFailure = "person_not_found" | "misconfigured" | "unknown";

/** Classifies a rejection from the Promise client. See {@link VoidhashFailure}. */
export const classifyVoidhashFailure = (error: unknown): VoidhashFailure => {
  const apiError = apiErrorOf(error);

  if (apiError?.code === "person_not_found") {
    return "person_not_found";
  }

  switch (apiError?.type) {
    case "unauthenticated":
    case "permission_denied":
      return "misconfigured";
    default:
      return "unknown";
  }
};

/**
 * Looks a person up by the distinct id the client passed to `identify()`.
 *
 * Returns `null` when Voidhash has never seen the id — a brand-new user is a
 * free user, not a 500. Every other failure propagates.
 */
export const findPersonByDistinctId = async (
  voidhash: VoidhashNodeClient,
  distinctId: string,
): Promise<VoidhashPerson | null> => {
  try {
    const page = await voidhash.persons.list({ params: { distinctId } });
    return page.data[0] ?? null;
  } catch (error) {
    const failure = classifyVoidhashFailure(error);

    if (failure === "person_not_found") {
      return null;
    }

    if (failure === "misconfigured") {
      console.error("[voidhash] secret key is invalid or lacks access.", error);
    }

    throw new VoidhashUnavailableError(`Could not look up person "${distinctId}".`, {
      cause: error,
    });
  }
};
