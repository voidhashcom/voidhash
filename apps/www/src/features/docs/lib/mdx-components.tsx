"use client";

import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { type ComponentProps, lazy } from "react";

import { DOCS_PATH } from "@/lib/paths";

// Lazy so the OpenAPI reference renderer (Scalar playground, shiki) is only
// pulled into the bundle for generated API pages, not every doc/guide page.
const OpenAPIPage = lazy(() => import("./openapi-page"));

/**
 * Renders links authored inside MDX. Root-relative hrefs (e.g. `/foo`) are
 * rewritten under the docs base path so they resolve to `/docs/foo`, while
 * absolute and protocol-relative URLs are left untouched.
 */
export function DocsMdxLink(props: ComponentProps<"a">) {
  const href = props.href;
  if (!href) {
    return <a {...props} />;
  }

  const normalizedHref =
    href.startsWith("/") && !href.startsWith(DOCS_PATH) && !href.startsWith("//")
      ? `${DOCS_PATH}${href}`
      : href;

  return <a {...props} href={normalizedHref} />;
}

/**
 * Shared MDX component registry used to render documentation content both on
 * the public docs site (`/docs/$`) and inside in-app guide sheets, so a guide
 * looks identical in either place. Register any custom MDX component here once.
 */
export const docsMdxComponents = {
  ...defaultMdxComponents,
  Accordion,
  Accordions,
  Callout,
  File,
  Files,
  Folder,
  Step,
  Steps,
  Tab,
  Tabs,
  TypeTable,
  // Generated OpenAPI pages render `<OpenAPIPage>`; `APIPage` is the legacy
  // (v10) alias the generator still emits for backward compatibility.
  OpenAPIPage,
  APIPage: OpenAPIPage,
  a: DocsMdxLink,
  iframe: (props: ComponentProps<"iframe">) => (
    <iframe {...props} className="h-[500px] w-full" />
  ),
};
