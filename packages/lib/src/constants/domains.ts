export type VercelEnv = "production" | "preview" | "development";

export type DomainConfig = {
  appDomain?: string;
  vercelEnv?: string;
};

const normalizeVercelEnv = (vercelEnv?: string): VercelEnv | undefined => {
  if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") {
    return vercelEnv;
  }

  return undefined;
};

/** Resolves the browser-facing application origin for a deployment. */
export const resolveFrontendOrigin = ({
  appDomain,
  vercelEnv,
}: DomainConfig): string | undefined => {
  const normalizedEnv = normalizeVercelEnv(vercelEnv);

  if (normalizedEnv === "development") {
    return "http://localhost:3000";
  }

  if (!appDomain) {
    return undefined;
  }

  return `https://${appDomain}`;
};

/** Resolves the API origin for a deployment. */
export const resolveApiOrigin = ({ appDomain, vercelEnv }: DomainConfig): string | undefined => {
  const normalizedEnv = normalizeVercelEnv(vercelEnv);

  if (normalizedEnv === "development") {
    return "http://localhost:8787";
  }

  if (!appDomain) {
    return undefined;
  }

  return `https://api.${appDomain}`;
};

/** Returns the application hostnames accepted for a deployment. */
export const resolveAppHostnames = (config: DomainConfig): Set<string> => {
  const hostnames = new Set(["localhost:3000", "localhost"]);
  const frontendOrigin = resolveFrontendOrigin(config);

  if (frontendOrigin) {
    hostnames.add(new URL(frontendOrigin).host);
  }

  if (config.appDomain) {
    hostnames.add(config.appDomain);
  }

  return hostnames;
};
