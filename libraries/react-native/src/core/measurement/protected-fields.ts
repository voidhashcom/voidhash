import { MeasurementInputError } from "./errors";

const PROTECTED_KEY = /(url|uri|token|receipt|jws|phone|email|idfa|idfv|gaid|oaid|aaid|android.?id|imei|referrer|secret|password|authorization)/i;

/** Rejects protected keys and URL/email-shaped values from public data structures. */
export const assertSafePublicValue = (value: unknown, path = "properties"): void => {
  if (typeof value === "string") {
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new MeasurementInputError(`Protected value is not allowed in ${path}`, path);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (PROTECTED_KEY.test(key)) {
      throw new MeasurementInputError(`Protected field is not allowed in ${path}`, nestedPath);
    }
    assertSafePublicValue(nested, nestedPath);
  }
};
