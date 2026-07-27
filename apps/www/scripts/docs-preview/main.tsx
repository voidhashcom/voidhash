import type * as PageTree from "fumadocs-core/page-tree";
import { FrameworkProvider } from "fumadocs-core/framework";
import { Callout } from "fumadocs-ui/components/callout";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { RootProvider } from "fumadocs-ui/provider/base";
import { type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";

import "../../src/styles/globals.css";
import { DocsLayout } from "../../src/features/docs/components/layout/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "../../src/features/docs/components/layout/page";

const page = (name: string, url: string): PageTree.Item => ({ name, type: "page", url });
const separator = (name: string): PageTree.Separator => ({ name, type: "separator" });

/** Stand-in for the generated fumadocs tree, shaped like the real docs content. */
const TREE: PageTree.Root = {
  name: "Docs",
  type: "root",
  children: [
    page("Introduction", "/docs/introduction"),
    page("Installation", "/docs/installation"),
    page("Basic usage", "/docs/basic-usage"),
    separator("Platform"),
    {
      name: "React Native",
      type: "folder",
      index: page("Overview", "/docs/react-native"),
      children: [
        page("Quickstart", "/docs/react-native/quickstart"),
        separator("Paywalls"),
        page("Rendering a paywall", "/docs/react-native/paywalls/rendering"),
        page("Placements", "/docs/react-native/paywalls/placements"),
      ],
    },
    page("CLI", "/docs/cli"),
    page("MCP server", "/docs/mcp"),
    separator("Reference"),
    page("SDKs and APIs", "/docs/sdks-and-apis"),
    {
      name: "Guides",
      type: "folder",
      index: page("All guides", "/docs/guides"),
      children: [page("App Store Connect", "/docs/guides/app-store-connect")],
    },
    {
      name: "API",
      type: "folder",
      index: page("Overview", "/docs/api/overview"),
      children: [
        page("Authentication", "/docs/api/authentication"),
        page("Persons", "/docs/api/persons"),
        page("Webhooks", "/docs/api/webhooks"),
      ],
    },
  ],
};

const TOC = [
  { depth: 2, title: "Install the SDK", url: "#install-the-sdk" },
  { depth: 2, title: "Configure your project", url: "#configure-your-project" },
  { depth: 3, title: "Environment variables", url: "#environment-variables" },
  { depth: 3, title: "Native modules", url: "#native-modules" },
  { depth: 2, title: "Render your first paywall", url: "#render-your-first-paywall" },
  { depth: 2, title: "Next steps", url: "#next-steps" },
];

function Sample() {
  return (
    <DocsPage toc={TOC}>
      <DocsTitle>Installation</DocsTitle>
      <DocsDescription>
        Add the Voidhash SDK to your React Native app and connect it to a project.
      </DocsDescription>
      <DocsBody>
        <p>
          Voidhash ships a single universal SDK for React Native. It bundles paywall rendering,
          entitlement checks, analytics capture and remote configuration, so you only install one
          package regardless of which parts of the platform you use.
        </p>
        <h2 id="install-the-sdk">Install the SDK</h2>
        <p>
          Install the package with your package manager of choice. The SDK requires React Native
          0.76 or newer and Expo SDK 52 or newer.
        </p>
        <pre>
          <code>pnpm add @voidhash/react-native</code>
        </pre>
        <h2 id="configure-your-project">Configure your project</h2>
        <p>
          Wrap your application in the provider and pass the publishable key for the project you
          want to target. Keys are scoped per project and per environment.
        </p>
        <h3 id="environment-variables">Environment variables</h3>
        <table>
          <thead>
            <tr>
              <th>Variable</th>
              <th>Required</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>VOIDHASH_PUBLISHABLE_KEY</code>
              </td>
              <td>Yes</td>
              <td>Identifies the project the client talks to.</td>
            </tr>
            <tr>
              <td>
                <code>VOIDHASH_HOST</code>
              </td>
              <td>No</td>
              <td>Override for self-hosted deployments.</td>
            </tr>
          </tbody>
        </table>
        <h3 id="native-modules">Native modules</h3>
        <ul>
          <li>Run a native rebuild after installing — the SDK links StoreKit and Billing.</li>
          <li>Expo Go is not supported; use a development build.</li>
          <li>
            See the <a href="#next-steps">development build guide</a> for the full setup.
          </li>
        </ul>
        <h2 id="render-your-first-paywall">Render your first paywall</h2>
        <p>
          Paywalls are addressed by placement, not by id, so you can swap the paywall shown at a
          placement from the dashboard without shipping an app update.
        </p>
        <blockquote>
          Placements are resolved server-side and cached locally, so the first render after a cold
          start is instant.
        </blockquote>
        <Callout title="Development builds">
          Expo Go cannot load the native module. Create a development build before continuing.
        </Callout>
        <CodeBlock lang="ts">
          <Pre>{`import { VoidhashProvider } from "@voidhash/react-native";\n\nexport default function App() {\n  return <VoidhashProvider publishableKey={KEY}>{children}</VoidhashProvider>;\n}`}</Pre>
        </CodeBlock>
        <Tabs items={["npm", "pnpm", "bun"]}>
          <Tab value="npm">npm install @voidhash/react-native</Tab>
          <Tab value="pnpm">pnpm add @voidhash/react-native</Tab>
          <Tab value="bun">bun add @voidhash/react-native</Tab>
        </Tabs>
        <h2 id="next-steps">Next steps</h2>
        <Steps>
          <Step>
            <h3>Create a paywall</h3>
            <p>Design it in the dashboard, then publish it to a placement.</p>
          </Step>
          <Step>
            <h3>Wire up the placement</h3>
            <p>Point your app at the placement key and ship.</p>
          </Step>
        </Steps>
        <p>Once the SDK is installed, continue with the quickstart to publish your first paywall.</p>
      </DocsBody>
    </DocsPage>
  );
}

function Preview() {
  const [pathname, setPathname] = useState("/docs/installation");

  return (
    <FrameworkProvider
      Link={({ href, children, ...props }: { href?: string; children?: ReactNode }) => (
        <a
          {...props}
          href={href ?? "#"}
          onClick={(event) => {
            event.preventDefault();
            if (href) {
              setPathname(href);
            }
          }}
        >
          {children}
        </a>
      )}
      usePathname={() => pathname}
      useParams={() => ({})}
      useRouter={() => ({
        push: setPathname,
        refresh: () => {},
      })}
    >
      <RootProvider theme={{ defaultTheme: "dark" }}>
        <DocsLayout tree={TREE}>
          <Sample />
        </DocsLayout>
      </RootProvider>
    </FrameworkProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Preview />);
