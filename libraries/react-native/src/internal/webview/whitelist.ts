function escapeRegex(input: string): string {
  return input.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

export function extractOrigin(url: string): string {
  const result = /^[A-Za-z][A-Za-z0-9+\-.]+:(\/\/)?[^/]*/.exec(url);
  return result === null ? "" : result[0];
}

function originWhitelistToRegex(originWhitelist: string): string {
  return `^${escapeRegex(originWhitelist).replace(/\*/g, ".*")}$`;
}

export function compileWhitelist(originWhitelist: readonly string[]): string[] {
  return ["about:blank", ...originWhitelist].map(originWhitelistToRegex);
}

export function passesWhitelist(
  compiledWhitelist: readonly string[],
  url: string
): boolean {
  const origin = extractOrigin(url);
  return compiledWhitelist.some((pattern) => new RegExp(pattern).test(origin));
}
