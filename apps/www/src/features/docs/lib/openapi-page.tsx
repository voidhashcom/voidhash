"use client";

import { type OpenAPIPageProps, createOpenAPIPage } from "fumadocs-openapi/ui";

import { DOCS_PATH } from "@/lib/paths";
import eventCaptureSpec from "../openapi/event-capture.json";
import voidhashV1Spec from "../openapi/voidhash-v1.json";

/**
 * The committed spec snapshots, keyed by the stable `document` id embedded in
 * generated pages (see `scripts/generate-openapi.ts`). fumadocs-openapi's page
 * generator writes `<OpenAPIPage document="<id>" .../>`; this map lets the
 * client component resolve the spec without a server round-trip.
 */
const SPECS: Record<string, unknown> = {
  "voidhash-v1": voidhashV1Spec,
  "event-capture": eventCaptureSpec,
};

const OpenAPIPageBase = createOpenAPIPage();

interface GeneratedOpenAPIPageProps {
  document: string;
  operations?: unknown[];
  webhooks?: unknown[];
}

/**
 * Renders a generated OpenAPI operation page. fumadocs-openapi's client
 * component expects the resolved spec via `payload`; because this app renders
 * MDX on the client (there is no RSC boundary), we supply the committed,
 * client-bundled spec keyed by the `document` id rather than resolving it
 * server-side.
 */
export default function OpenAPIPage(props: GeneratedOpenAPIPageProps) {
  const bundled = SPECS[props.document];
  if (!bundled) {
    return null;
  }

  const resolved = {
    ...props,
    payload: { bundled, proxyUrl: `${DOCS_PATH}/api/proxy` },
  } as unknown as OpenAPIPageProps;

  return <OpenAPIPageBase {...resolved} />;
}
