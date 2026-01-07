import { loader } from "fumadocs-core/source";
import * as icons from "lucide-static";

import { docs } from "@/.source";

// See https://fumadocs.vercel.app/docs/headless/source-api for more info
export const source = loader({
  // it assigns a URL to your pages
  baseUrl: "/",
  icon(icon) {
    if (!icon) {
      return;
    }

    if (icon in icons) {
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: staticly built
      return icons[icon as keyof typeof icons] as unknown as React.ReactElement;
    }
  },
  source: docs.toFumadocsSource(),
});
