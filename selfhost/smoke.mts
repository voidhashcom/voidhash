import { Primitive } from "../packages/mimic-core/src/index.ts";
import { MimicSDK } from "../packages/mimic-server/src/index.ts";
import WebSocket from "ws";

const url = process.env.MIMIC_URL ?? "http://127.0.0.1:5001";
const username = process.env.MIMIC_ROOT_USERNAME ?? "root";
const password = process.env.MIMIC_ROOT_PASSWORD ?? "password";

const waitForHealth = async (): Promise<void> => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // The compose service may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}/health`);
};

const assertApplicationSurface = async (): Promise<void> => {
  const capabilitiesResponse = await fetch(`${url}/api/runtime-capabilities`);
  if (!capabilitiesResponse.ok) {
    throw new Error(`Runtime capabilities returned ${capabilitiesResponse.status}`);
  }
  const capabilities = await capabilitiesResponse.json();
  if (
    JSON.stringify(capabilities) !==
    JSON.stringify({ enterprise: { auditLogs: false, billing: false } })
  ) {
    throw new Error(`Unexpected Community capabilities: ${JSON.stringify(capabilities)}`);
  }

  const wwwResponse = await fetch(`${url}/`);
  if (!wwwResponse.ok) {
    throw new Error(`WWW returned ${wwwResponse.status}`);
  }
};

const authenticateSocket = (socketUrl: string, token: string): Promise<unknown[]> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(socketUrl);
    const messages: unknown[] = [];
    const transactionId = `smoke-${crypto.randomUUID()}`;
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for the WebSocket transaction")),
      10_000,
    );
    socket.once("error", reject);
    socket.once("open", () => socket.send(JSON.stringify({ type: "auth", token })));
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString()) as { readonly type?: string };
      messages.push(message);
      if (message.type === "snapshot") {
        const version =
          "version" in message && typeof message.version === "number"
            ? message.version
            : 1;
        const value = "value" in message ? message.value : undefined;
        socket.send(
          JSON.stringify({
            type: "submit",
            transaction: {
              id: transactionId,
              baseVersion: version,
              commands: [{ kind: "value.set", path: [], value }],
            },
          }),
        );
      }
      if (message.type === "transaction") {
        clearTimeout(timeout);
        socket.close(1000, "smoke complete");
        resolve(messages);
      }
    });
  });

await waitForHealth();
await assertApplicationSurface();
const sdk = new MimicSDK({ url, username, password });
const database = await sdk.createDatabase({
  name: `compose-smoke-${crypto.randomUUID()}`,
  description: "self-host compose smoke",
});
let collectionId: string | undefined;
let documentId: string | undefined;

try {
  const collection = await database.createCollection(
    "documents",
    Primitive.Struct({ title: Primitive.String().required() }),
  );
  collectionId = collection.id;
  const document = await collection.create({ title: "compose is live" });
  documentId = document.id;
  const authentication = await collection.setupDocumentAuthentication({
    documentId: document.id,
    permission: "write",
    origins: [],
    expiresInSeconds: 60,
  });
  const messages = await authenticateSocket(authentication.url, authentication.token);
  const authenticated = messages.some(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "auth_result" &&
      "success" in message &&
      message.success === true,
  );
  const snapshot = messages.some(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "snapshot",
  );
  const transaction = messages.some(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "transaction",
  );
  if (!authenticated || !snapshot || !transaction) {
    throw new Error(
      "WebSocket authentication, snapshot, or transaction message was missing",
    );
  }
  console.log("Self-host compose smoke passed");
} finally {
  if (collectionId) {
    const collection = database.collection(
      collectionId,
      Primitive.Struct({ title: Primitive.String().required() }),
    );
    if (documentId) await collection.delete(documentId);
    await database.deleteCollection(collectionId);
  }
  await sdk.deleteDatabase(database.id);
  await sdk.dispose();
}
