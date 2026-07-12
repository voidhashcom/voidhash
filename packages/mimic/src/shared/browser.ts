export const resolveFetch = (candidate?: typeof globalThis.fetch): typeof globalThis.fetch => {
  const resolved = candidate ?? globalThis.fetch;
  if (typeof resolved !== "function") {
    throw new Error("fetch is not available in this runtime");
  }
  return resolved;
};

export const resolveWebSocket = (
  candidate?: typeof globalThis.WebSocket,
): typeof globalThis.WebSocket => {
  const resolved = candidate ?? globalThis.WebSocket;
  if (typeof resolved !== "function") {
    throw new Error("WebSocket is not available in this runtime");
  }
  return resolved;
};

export const encodeBasicAuth = (username: string, password: string): string => {
  const value = `${username}:${password}`;
  if (typeof Buffer !== "undefined") {
    return `Basic ${Buffer.from(value, "utf8").toString("base64")}`;
  }
  if (typeof globalThis.btoa === "function") {
    return `Basic ${globalThis.btoa(value)}`;
  }
  throw new Error("No base64 encoder is available in this runtime");
};

export const joinUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
