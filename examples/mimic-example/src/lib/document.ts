import { createClientDocument, WebSocketTransport } from "@voidhash/mimic/client";
import { ExamplePresencePrimitive, MimicExampleSchema, type ExamplePresence } from "../shared";
import { exampleServerUrl } from "./serverConfig";

interface TokenResponse {
  token: string;
  url: string;
}

async function fetchToken(): Promise<TokenResponse> {
  const res = await fetch(`${exampleServerUrl}/api/token`);
  if (!res.ok) throw new Error(`Failed to fetch token: ${res.status}`);
  return res.json();
}

export async function createDocument(initialPresence?: ExamplePresence) {
  const { token, url } = await fetchToken();
  let nextToken: string | null = token;

  return createClientDocument({
    primitive: MimicExampleSchema,
    presence: {
      primitive: ExamplePresencePrimitive,
      initial: initialPresence,
    },
    transport: new WebSocketTransport({
      url,
      token: async () => {
        if (nextToken !== null) {
          const current = nextToken;
          nextToken = null;
          return current;
        }
        const auth = await fetchToken();
        return auth.token;
      },
    }),
  });
}
