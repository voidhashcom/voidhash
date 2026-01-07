import { SHORT_DOMAIN } from "@voidhash/lib";
import type { NextRequest } from "next/server";

const WWW_REGEX = /^www./;

export const parse = (req: NextRequest) => {
  let domain = req.headers.get("host") as string;
  // remove www. from domain and convert to lowercase
  domain = domain.replace(WWW_REGEX, "").toLowerCase();
  if (domain === "voidhash.localhost:3000" || domain.endsWith(".vercel.app")) {
    // for local development and preview URLs
    domain = SHORT_DOMAIN;
  }

  // path is the path of the URL (e.g. dub.sh/stats/github -> /stats/github)
  const path = req.nextUrl.pathname;
  const pathParts = path.split("/");
  const organizationSlug = pathParts[1] !== "~" ? pathParts[1] : null;
  const projectSlug = pathParts[2] !== "~" ? pathParts[2] : null;

  // fullPath is the full URL path (along with search params)
  const searchParams = req.nextUrl.searchParams.toString();
  const searchParamsObj = Object.fromEntries(req.nextUrl.searchParams);
  const searchParamsString = searchParams.length > 0 ? `?${searchParams}` : "";
  const fullPath = `${path}${searchParamsString}`;

  // Here, we are using decodeURIComponent to handle foreign languages like Hebrew
  const key = decodeURIComponent(path.split("/")[1] ?? ""); // key is the first part of the path (e.g. dub.sh/stats/github -> stats)
  const fullKey = decodeURIComponent(path.slice(1)); // fullKey is the full path without the first slash (to account for multi-level subpaths, e.g. d.to/github/repo -> github/repo)

  return {
    domain,
    fullKey,
    fullPath,
    key,
    organizationSlug,
    path,
    projectSlug,
    searchParamsObj,
    searchParamsString,
  };
};
