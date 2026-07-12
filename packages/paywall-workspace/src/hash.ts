/**
 * The content-address of a code-component's source — the single hash both the
 * browser compile pipeline and the server manifest cache agree on.
 *
 * A synchronous SHA-256 over the UTF-8 source text, returned as 64 lowercase
 * hex chars. It is a global content address (the primary key of the shared,
 * unscoped `paywall_component_manifest` cache), so it must resist adversarial
 * collisions — a cryptographic digest, not a cheap fold. It stays SYNC because
 * every caller is sync (the browser compile-state keys, `waitForCompile` keys,
 * and the pure `componentSourceHashes` / `buildRegistryFromSnapshot` on the
 * server); inputs are KB-sized and hashed only at compile time, so a pure-TS
 * implementation is more than fast enough and needs no `crypto`/`SubtleCrypto`
 * (the latter is async-only in the browser).
 *
 * Kept here, in the pure isomorphic workspace package, so the browser (which
 * uploads `(sourceHash, manifest)` after each compile) and the server (which
 * looks manifests up by `hashSource(codeComponent.source)`) can never drift —
 * the moment they disagree the server would fail to resolve a just-compiled
 * component's manifest.
 */
export function hashSource(input: string): string {
  return sha256Hex(new TextEncoder().encode(input));
}

// SHA-256 round constants (first 32 bits of the fractional parts of the cube
// roots of the first 64 primes).
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (value: number, bits: number): number =>
  ((value >>> bits) | (value << (32 - bits))) >>> 0;

/**
 * Pure synchronous SHA-256 of a byte array, returned as 64 lowercase hex chars.
 * A textbook FIPS 180-4 implementation over 512-bit blocks with the standard
 * length-in-bits padding; kept dependency-free and self-contained.
 */
function sha256Hex(bytes: Uint8Array): string {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  // Padded message length: original bytes + 1 marker byte + zero-fill so the
  // total is a multiple of 64, with the last 8 bytes holding the bit length.
  const bitLength = bytes.length * 8;
  const paddedLength = ((bytes.length + 8) >> 6) * 64 + 64;
  const message = new Uint8Array(paddedLength);
  message.set(bytes);
  message[bytes.length] = 0x80;
  // 64-bit big-endian bit length in the final 8 bytes. Sources are far below
  // 2^32 bits, so the high word is always zero — write the low 32 bits.
  const view = new DataView(message.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let t = 0; t < 16; t += 1) {
      w[t] = view.getUint32(offset + t * 4, false);
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15]!, 7) ^ rotr(w[t - 15]!, 18) ^ (w[t - 15]! >>> 3);
      const s1 = rotr(w[t - 2]!, 17) ^ rotr(w[t - 2]!, 19) ^ (w[t - 2]! >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }

    let a = h[0]!;
    let b = h[1]!;
    let c = h[2]!;
    let d = h[3]!;
    let e = h[4]!;
    let f = h[5]!;
    let g = h[6]!;
    let hh = h[7]!;

    for (let t = 0; t < 64; t += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[t]! + w[t]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
    h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0;
    h[7] = (h[7]! + hh) >>> 0;
  }

  let hex = "";
  for (let i = 0; i < 8; i += 1) {
    hex += h[i]!.toString(16).padStart(8, "0");
  }
  return hex;
}
