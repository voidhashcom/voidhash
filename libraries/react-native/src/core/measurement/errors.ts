/** Stable error codes exposed by all unified measurement namespaces. */
export type MeasurementErrorCode =
  | "capabilityUnavailable"
  | "invalidConfiguration"
  | "invalidInput"
  | "policyBlocked"
  | "notInitialized"
  | "transport"
  | "timeout"
  | "unknownNative";

/** Base typed error for measurement, links, consent, and notifications. */
export class MeasurementError extends Error {
  readonly code: MeasurementErrorCode;
  readonly source: "ios" | "android" | "core";
  readonly detail?: Readonly<Record<string, string | number | boolean>>;

  constructor(options: {
    readonly code: MeasurementErrorCode;
    readonly message: string;
    readonly source?: "ios" | "android" | "core";
    readonly detail?: Readonly<Record<string, string | number | boolean>>;
    readonly cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "MeasurementError";
    this.code = options.code;
    this.source = options.source ?? "core";
    this.detail = options.detail;
  }
}

/** Raised when a platform or build does not contain a requested capability. */
export class MeasurementCapabilityUnavailable extends MeasurementError {
  readonly capability: string;
  readonly reason: "notConfigured" | "notImplemented" | "notInstalled" | "unsupported" | "disabled";

  constructor(capability: string, reason: MeasurementCapabilityUnavailable["reason"]) {
    super({
      code: "capabilityUnavailable",
      message: `Measurement capability '${capability}' is ${reason}`,
      detail: { capability, reason },
    });
    this.name = "MeasurementCapabilityUnavailable";
    this.capability = capability;
    this.reason = reason;
  }
}

/** Raised when a configuration patch violates a documented invariant. */
export class MeasurementConfigurationError extends MeasurementError {
  constructor(message: string, field?: string) {
    super({
      code: "invalidConfiguration",
      message,
      detail: field ? { field } : undefined,
    });
    this.name = "MeasurementConfigurationError";
  }
}

/** Raised for malformed or unsafe public inputs. */
export class MeasurementInputError extends MeasurementError {
  constructor(message: string, field?: string) {
    super({ code: "invalidInput", message, detail: field ? { field } : undefined });
    this.name = "MeasurementInputError";
  }
}

/** Raised when an effective collection policy denies an operation. */
export class MeasurementPolicyBlocked extends MeasurementError {
  constructor(category: string) {
    super({
      code: "policyBlocked",
      message: `Measurement policy blocks '${category}'`,
      detail: { category },
    });
    this.name = "MeasurementPolicyBlocked";
  }
}

/** Converts a structured native bridge failure into the public hierarchy. */
export const mapNativeMeasurementError = (input: {
  readonly code: string;
  readonly message?: string;
  readonly source?: "ios" | "android" | "core";
}): MeasurementError => {
  const knownCodes = new Set<MeasurementErrorCode>([
    "capabilityUnavailable",
    "invalidConfiguration",
    "invalidInput",
    "policyBlocked",
    "notInitialized",
    "transport",
    "timeout",
    "unknownNative",
  ]);
  const code = knownCodes.has(input.code as MeasurementErrorCode)
    ? (input.code as MeasurementErrorCode)
    : "unknownNative";
  return new MeasurementError({
    code,
    message: input.message?.slice(0, 256) || "Native measurement operation failed",
    source: input.source,
  });
};
