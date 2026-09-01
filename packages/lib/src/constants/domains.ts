import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";

export type VercelEnv = "production" | "preview" | "development";

export type DomainConfig = {
  readonly appDomain: Option.Option<string>;
  readonly vercelEnv: Option.Option<string>;
};

const isVercelEnv = (value: string): value is VercelEnv =>
  value === "production" || value === "preview" || value === "development";

const normalizeVercelEnv = (vercelEnv: Option.Option<string>): Option.Option<VercelEnv> =>
  Option.filter(vercelEnv, isVercelEnv);

/** Resolves the browser-facing application origin for a deployment. */
export const resolveFrontendOrigin = ({
  appDomain,
  vercelEnv,
}: DomainConfig): Option.Option<string> => {
  const normalizedEnv = normalizeVercelEnv(vercelEnv);

  if (Option.contains(normalizedEnv, "development")) {
    return Option.some("http://localhost:3000");
  }

  return Option.map(appDomain, (domain) => `https://${domain}`);
};

/** Resolves the API origin for a deployment. */
export const resolveApiOrigin = ({ appDomain, vercelEnv }: DomainConfig): Option.Option<string> => {
  const normalizedEnv = normalizeVercelEnv(vercelEnv);

  if (Option.contains(normalizedEnv, "development")) {
    return Option.some("http://localhost:8787");
  }

  return Option.map(appDomain, (domain) => `https://api.${domain}`);
};

/** Returns the application hostnames accepted for a deployment. */
export const resolveAppHostnames = (config: DomainConfig): HashSet.HashSet<string> =>
  HashSet.fromIterable([
    "localhost:3000",
    "localhost",
    ...Option.toArray(Option.map(resolveFrontendOrigin(config), (origin) => new URL(origin).host)),
    ...Option.toArray(config.appDomain),
  ]);
