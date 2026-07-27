export const generateFallbackNonce = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const getNonce = () => {
  const cryptoObject = globalThis.crypto as { randomUUID?: () => string } | undefined;
  return cryptoObject?.randomUUID?.() ?? generateFallbackNonce();
};
