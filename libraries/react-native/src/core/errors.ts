// /**
//  * Centralized error codes for Voidhash React Native
//  *
//  * Error format: ERROR_CODE: descriptive message
//  * All error codes should be descriptive and unique across the entire codebase
//  */

// export const VOIDHASH_ERROR_CODES = {
//   // Initialization errors
//   VOIDHASH_CLIENT_NOT_INITIALIZED:
//     'VOIDHASH_CLIENT_NOT_INITIALIZED: Not initialized',
//   STOREKIT_NOT_INITIALIZED:
//     'STOREKIT_NOT_INITIALIZED: StoreKit connection not initialized',
//   GOOGLE_BILLING_NOT_INITIALIZED:
//     'GOOGLE_BILLING_NOT_INITIALIZED: Google Billing connection not initialized',

//   // Product errors
//   INVALID_PRODUCT_ID: 'INVALID_PRODUCT_ID: Product not found in store',
//   EMPTY_SKU_LIST: 'EMPTY_SKU_LIST: No SKUs provided for product query',
//   SKU_NOT_FOUND:
//     'SKU_NOT_FOUND: The SKU was not found. Please fetch products first by calling getItems',
//   SKU_OFFER_MISMATCH:
//     'SKU_OFFER_MISMATCH: The number of SKUs must match the number of offer tokens for subscriptions',

//   // Purchase errors
//   PURCHASE_FAILED: 'PURCHASE_FAILED: Purchase operation failed',
//   USER_CANCELLED: 'USER_CANCELLED: User cancelled the purchase',
//   PURCHASE_PENDING: 'PURCHASE_PENDING: The payment was deferred',
//   PURCHASE_UNKNOWN_RESULT: 'PURCHASE_UNKNOWN_RESULT: Unknown purchase result',

//   // Transaction errors
//   TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND: Transaction not found',
//   TRANSACTION_VERIFICATION_FAILED:
//     'TRANSACTION_VERIFICATION_FAILED: Transaction verification failed',

//   // Platform-specific errors
//   WINDOW_SCENE_NOT_FOUND:
//     'WINDOW_SCENE_NOT_FOUND: Could not find window scene for UI presentation',
//   CURRENT_ACTIVITY_NULL:
//     'CURRENT_ACTIVITY_NULL: Current activity returned null',
//   BILLING_ERROR: 'BILLING_ERROR: Google Billing operation failed',

//   // Method availability errors
//   METHOD_NOT_AVAILABLE_TVOS:
//     'METHOD_NOT_AVAILABLE_TVOS: Method is not available on tvOS platform',
//   METHOD_NOT_AVAILABLE_PLATFORM:
//     'METHOD_NOT_AVAILABLE_PLATFORM: Method is not available on this platform',

//   // Network and API errors
//   NETWORK_ERROR: 'NETWORK_ERROR: Network operation failed',
//   API_ERROR: 'API_ERROR: API operation failed',
//   RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED: Rate limit exceeded',
//   AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED: Authentication failed',

//   // Configuration errors
//   CONFIGURATION_MISSING:
//     'CONFIGURATION_MISSING: Required configuration is missing',
//   UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM: Platform is not supported',

//   // General errors
//   UNKNOWN_ERROR: 'UNKNOWN_ERROR: An unknown error occurred',
//   OPERATION_FAILED: 'OPERATION_FAILED: Operation failed'
// } as const;

// export type VoidhashErrorCode = keyof typeof VOIDHASH_ERROR_CODES;

// export class VoidhashError extends Error {
//   readonly code: VoidhashErrorCode;
//   readonly originalError?: Error;

//   constructor(code: VoidhashErrorCode, originalError?: Error) {
//     const message = VOIDHASH_ERROR_CODES[code];
//     super(message);
//     this.name = 'VoidhashError';
//     this.code = code;
//     this.originalError = originalError;
//   }

//   static fromCode(
//     code: VoidhashErrorCode,
//     originalError?: Error
//   ): VoidhashError {
//     return new VoidhashError(code, originalError);
//   }

//   static fromMessage(message: string): VoidhashError {
//     // Try to extract error code from message
//     const colonIndex = message.indexOf(':');
//     if (colonIndex > 0) {
//       const code = message.substring(0, colonIndex) as VoidhashErrorCode;
//       if (code in VOIDHASH_ERROR_CODES) {
//         return new VoidhashError(code);
//       }
//     }

//     // Fallback to unknown error
//     return new VoidhashError('UNKNOWN_ERROR');
//   }
// }

// /**
//  * Helper function to create error messages in the format expected by native modules
//  */
// export function createNativeErrorMessage(
//   code: VoidhashErrorCode,
//   additionalInfo?: string
// ): string {
//   const baseMessage = VOIDHASH_ERROR_CODES[code];
//   if (additionalInfo) {
//     return `${baseMessage} - ${additionalInfo}`;
//   }
//   return baseMessage;
// }

// /**
//  * Helper function to parse error messages from native modules and convert them to VoidhashError
//  */
// export function parseNativeError(errorMessage: string): VoidhashError {
//   // Try to extract error code from message
//   const colonIndex = errorMessage.indexOf(':');
//   if (colonIndex > 0) {
//     const code = errorMessage.substring(0, colonIndex) as VoidhashErrorCode;
//     if (code in VOIDHASH_ERROR_CODES) {
//       return new VoidhashError(code);
//     }
//   }

//   // Fallback to unknown error
//   return new VoidhashError('UNKNOWN_ERROR', new Error(errorMessage));
// }
