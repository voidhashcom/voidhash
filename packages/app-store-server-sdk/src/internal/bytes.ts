/**
 * WebCrypto-only byte/encoding helpers.
 *
 * This module deliberately avoids Node's `Buffer` so the SDK runs unchanged on
 * Cloudflare Workers (workerd). All helpers use `atob`/`btoa`, `TextEncoder`/
 * `TextDecoder`, and `Uint8Array`, which are available on both Node 18+ and
 * workerd.
 */

/** Decode a standard (non-url) base64 string into raw bytes. */
export const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/** Encode raw bytes as a standard (non-url) base64 string. */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
};

const HEX_ALPHABET = "0123456789abcdef";

/** Encode raw bytes as a lowercase hex string. */
export const bytesToHex = (bytes: Uint8Array): string => {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number;
    hex += HEX_ALPHABET.charAt(byte >> 4) + HEX_ALPHABET.charAt(byte & 0x0f);
  }
  return hex;
};

/** Decode a hex string into raw bytes. Trailing odd nibble is ignored. */
export const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/** UTF-8 encode a string to bytes. */
export const utf8ToBytes = (text: string): Uint8Array => new TextEncoder().encode(text);

/** UTF-8 decode bytes to a string. */
export const bytesToUtf8 = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/**
 * Convert a fixed-width IEEE-P1363 ECDSA signature (`r‖s`, the format emitted by
 * `crypto.subtle.sign({name:"ECDSA"})`) into the ASN.1 DER `Ecdsa-Sig-Value`
 * encoding (`SEQUENCE { INTEGER r, INTEGER s }`).
 *
 * Apple's legacy V1 promotional-offer signature is the DER form — the same bytes
 * Node's `crypto.createSign(...).sign(key)` produced — so this conversion is
 * required to keep the signature byte-compatible after the port to WebCrypto.
 * Conflating the raw and DER encodings is the classic ECDSA-on-Workers bug.
 */
export const rawEcdsaSignatureToDer = (raw: Uint8Array): Uint8Array => {
  const halfLength = raw.length / 2;
  const toDerInteger = (bytes: Uint8Array): Uint8Array => {
    // Strip leading zero bytes (but keep at least one byte).
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) {
      start++;
    }
    let trimmed = bytes.slice(start);
    // DER INTEGERs are signed: prepend 0x00 when the high bit is set so the
    // value isn't misread as negative.
    if ((trimmed[0] as number) & 0x80) {
      const padded = new Uint8Array(trimmed.length + 1);
      padded.set(trimmed, 1);
      trimmed = padded;
    }
    const encoded = new Uint8Array(trimmed.length + 2);
    encoded[0] = 0x02; // INTEGER tag
    encoded[1] = trimmed.length;
    encoded.set(trimmed, 2);
    return encoded;
  };

  const r = toDerInteger(raw.slice(0, halfLength));
  const s = toDerInteger(raw.slice(halfLength));
  const body = new Uint8Array(r.length + s.length);
  body.set(r, 0);
  body.set(s, r.length);

  const der = new Uint8Array(body.length + 2);
  der[0] = 0x30; // SEQUENCE tag
  der[1] = body.length;
  der.set(body, 2);
  return der;
};
