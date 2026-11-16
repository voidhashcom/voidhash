import * as Option from "effect/Option";
import * as P from "effect/Predicate";

/** What a rejection from a native hybrid says once the bridge's wrapping is removed. */
export interface NativeError {
  /** The leading `CODE` of a `"CODE: detail"` message, when it has one. */
  readonly code: Option.Option<string>;
  /**
   * The first line of the message. With a code, it starts at the code, so
   * the bridge's prefixes are dropped; without one, it is the whole line,
   * where the exception class or method name is the most useful part.
   */
  readonly message: string;
}

/** A stable failure code: `USER_CANCELLED`, `STOREKIT_NOT_INITIALIZED`, … */
const CODE = /^[A-Z][A-Z0-9_]*$/;

/**
 * A `label: ` in front of the rest of the message: a code, a Java or Kotlin
 * exception class (`com.voidhash.core.billing.BillingEngineException`), or
 * the hybrid method Nitro names for a synchronous throw
 * (`GoogleBilling.buyItemByType(...)`). The rest may be empty: Play often
 * gives no detail, so Android's `"CODE: detail"` can end at the colon.
 */
const LABEL = /^`?([A-Za-z_$][\w$.]*(?:\(\.\.\.\))?)`?:(?:\s+([\s\S]*))?$/;

/** How many labels can wrap one message: a Nitro method name around an exception class. */
const MAX_LABELS = 3;

/**
 * Reads the code and message a native hybrid rejected with.
 *
 * The native SDKs reject with `"CODE: detail"`, but the message reaches
 * JavaScript wrapped differently per platform. On Android it is
 * `"<exception class>: CODE: detail"`, possibly followed by `\tat …` stack
 * frames. Nitro puts `"<Hybrid>.<method>(...): "` in front of anything a
 * method throws synchronously, on both platforms. An iOS rejection is the
 * Swift error's description, usually the bare `"CODE: detail"`.
 *
 * Only the first line is read, so a stack trace never reaches a code
 * comparison or a message shown to the app.
 */
export const readNativeError = (error: unknown): NativeError => {
  const raw = P.isError(error) ? error.message : P.isString(error) ? error : String(error);
  const firstLine = (raw.split(/\r?\n/, 1)[0] ?? "").trim();

  const findCode = (message: string, depth: number): Option.Option<NativeError> => {
    if (CODE.test(message)) return Option.some({ code: Option.some(message), message });
    const label = LABEL.exec(message);
    if (label === null) return Option.none();
    const [, name = "", rest = ""] = label;
    if (CODE.test(name)) return Option.some({ code: Option.some(name), message });
    return depth < MAX_LABELS ? findCode(rest, depth + 1) : Option.none();
  };

  return Option.getOrElse(findCode(firstLine, 0), () => ({
    code: Option.none<string>(),
    message: firstLine,
  }));
};

/** Whether a native rejection carries `code`. */
export const hasNativeErrorCode = (error: unknown, code: string): boolean =>
  Option.contains(readNativeError(error).code, code);
