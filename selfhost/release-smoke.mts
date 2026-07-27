import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { CLICKHOUSE_EVENTS_TABLE } from "../packages/clickhouse-db/src/analytics/schema.ts";
import {
  createInitialPaywallDocumentInput,
  PaywallDesignerDocument,
} from "../packages/mimic-schema/src/index.ts";
import { MimicSDK } from "../packages/mimic-server/src/index.ts";
import WebSocket from "ws";

const url = process.env.MIMIC_URL ?? "http://127.0.0.1:5001";
const username = process.env.MIMIC_ROOT_USERNAME ?? "root";
const password = process.env.MIMIC_ROOT_PASSWORD ?? "password";
const databaseUsername = process.env.DATABASE_USERNAME ?? "voidhash";
const databaseName = process.env.DATABASE_NAME ?? "voidhash";
const composeFile = fileURLToPath(new URL("./docker-compose.yml", import.meta.url));
const suffix = crypto.randomUUID();
const projectId = `project_release_smoke_${suffix}`;
const paywallId = suffix;
const apiKeyId = `api_key_release_smoke_${suffix}`;
const apiKey = `vh_pk_${suffix.replaceAll("-", "")}`;
const locationId = `location_release_smoke_${suffix}`;
const locationSlug = `release-smoke-${suffix}`;
const showingId = `showing_release_smoke_${suffix}`;
const releaseUserId = `user_release_smoke_${suffix}`;

const quoteSql = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const runPostgres = (sql: string, tuplesOnly = false): string =>
  execFileSync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "postgres",
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      ...(tuplesOnly ? ["-A", "-t"] : []),
      "-U",
      databaseUsername,
      "-d",
      databaseName,
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();

interface PublishedReleaseResult {
  readonly draft: {
    readonly releaseId: string;
    readonly version: number;
  };
  readonly published: {
    readonly htmlUrl: string;
    readonly releaseId: string;
    readonly version: number;
  };
}

const publishRelease = (): PublishedReleaseResult => {
  const output = execFileSync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "-e",
      `SELFHOST_RELEASE_PAYWALL_ID=${paywallId}`,
      "-e",
      `SELFHOST_RELEASE_PROJECT_ID=${projectId}`,
      "-e",
      `SELFHOST_RELEASE_USER_ID=${releaseUserId}`,
      "app",
      "./node_modules/.bin/tsx",
      "src/release-smoke.ts",
    ],
    { encoding: "utf8" },
  );
  const prefix = "SELFHOST_RELEASE_RESULT ";
  const resultLine = output
    .split(/\r?\n/)
    .find((line) => line.startsWith(prefix));
  if (!resultLine) {
    throw new Error(`Release publisher returned no result: ${output}`);
  }
  return JSON.parse(resultLine.slice(prefix.length)) as PublishedReleaseResult;
};

const resolvePaywallThroughSdk = async (): Promise<PublishedReleaseResult["published"]> => {
  const response = await fetch(`${url}/api/v1/sdk/resolve-paywall`, {
    body: JSON.stringify({ locationSlug }),
    headers: {
      "content-type": "application/json",
      "x-client-bundle-id": "com.voidhash.selfhost-release-smoke",
      "x-distinct-id": `person_release_smoke_${suffix}`,
      "x-is-backgrounded": "false",
      "x-is-debug-build": "true",
      "x-observer-mode": "false",
      "x-platform": "ios",
      "x-platform-flavor": "native",
      "x-publishable-key": apiKey,
      "x-sdk": "react-native",
      "x-sdk-version": "selfhost-release-smoke",
    },
    method: "POST",
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`SDK paywall resolve returned ${response.status}: ${body}`);
  }
  const resolved = JSON.parse(body) as {
    readonly location?: { readonly slug?: string };
    readonly showing?: {
      readonly paywallRelease?: PublishedReleaseResult["published"] | null;
    };
  } | null;
  const published = resolved?.showing?.paywallRelease;
  if (resolved?.location?.slug !== locationSlug || !published) {
    throw new Error(`SDK resolved an unexpected paywall: ${body}`);
  }
  return published;
};

const waitFor = async <A,>(
  load: () => Promise<A | undefined>,
  message: string,
  timeoutMs = 30_000,
): Promise<A> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await load();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(message);
};

const submitEdit = (
  socketUrl: string,
  token: string,
  value: unknown,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(socketUrl);
    const transactionId = `release-smoke-${crypto.randomUUID()}`;
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for the paywall transaction")),
      10_000,
    );
    socket.once("error", reject);
    socket.once("open", () => socket.send(JSON.stringify({ type: "auth", token })));
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString()) as {
        readonly type?: string;
        readonly version?: number;
      };
      if (message.type === "snapshot") {
        socket.send(
          JSON.stringify({
            type: "submit",
            transaction: {
              id: transactionId,
              baseVersion: message.version ?? 1,
              commands: [{ kind: "value.set", path: [], value }],
            },
          }),
        );
      }
      if (message.type === "transaction") {
        clearTimeout(timeout);
        socket.close(1000, "release smoke edit complete");
        resolve();
      }
    });
  });

const countCapturedEvents = async (): Promise<number> => {
  const clickhouseUrl = new URL(
    process.env.CLICKHOUSE_PUBLIC_URL ??
      `http://127.0.0.1:${process.env.CLICKHOUSE_HTTP_PORT ?? "8123"}`,
  );
  clickhouseUrl.searchParams.set("database", process.env.CLICKHOUSE_DATABASE ?? "voidhash");
  const credentials = Buffer.from(
    `${process.env.CLICKHOUSE_ADMIN_USERNAME ?? "voidhash_admin"}:${
      process.env.CLICKHOUSE_ADMIN_PASSWORD ?? "password"
    }`,
  ).toString("base64");
  const response = await fetch(clickhouseUrl, {
    body: `SELECT count() AS total FROM ${CLICKHOUSE_EVENTS_TABLE} WHERE project_id = ${quoteSql(
      projectId,
    )} FORMAT JSONEachRow`,
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "text/plain",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`ClickHouse query returned ${response.status}: ${await response.text()}`);
  }
  const body = (await response.text()).trim();
  if (!body) return 0;
  return Number((JSON.parse(body) as { readonly total: string }).total);
};

const sdk = new MimicSDK({ url, username, password });
let paywallDocumentCreated = false;

try {
  runPostgres(`
    INSERT INTO project (id, name, organization_id, slug)
    VALUES (${quoteSql(projectId)}, 'Release smoke', ${quoteSql(
      `organization_release_smoke_${suffix}`,
    )}, ${quoteSql(`release-smoke-${suffix}`)});
    INSERT INTO paywall (id, name, project_id, slug)
    VALUES (${quoteSql(paywallId)}, 'Release smoke paywall', ${quoteSql(
      projectId,
    )}, ${quoteSql(`release-smoke-${suffix}`)});
    INSERT INTO api_key (id, name, "end", key, prefix, is_public, project_id)
    VALUES (${quoteSql(apiKeyId)}, 'Release smoke', ${quoteSql(
      apiKey.slice(-4),
    )}, ${quoteSql(apiKey)}, 'vh_pk_', true, ${quoteSql(projectId)});
  `);

  const databaseInfo = (await sdk.listDatabases()).find(
    (database) => database.name === "voidhash",
  );
  const database = databaseInfo
    ? sdk.database(databaseInfo.id, databaseInfo.name, databaseInfo.description)
    : await sdk.createDatabase({
        description: "Voidhash paywall documents",
        name: "voidhash",
      });
  const collectionInfo = (await database.listCollections()).find(
    (collection) => collection.name === "paywalls",
  );
  const collection = collectionInfo
    ? database.collection(collectionInfo.id, PaywallDesignerDocument)
    : await database.createCollection("paywalls", PaywallDesignerDocument);
  const initial = createInitialPaywallDocumentInput();
  await collection.create(initial, { id: paywallId });
  paywallDocumentCreated = true;
  const authentication = await collection.setupDocumentAuthentication({
    documentId: paywallId,
    expiresInSeconds: 60,
    origins: [],
    permission: "write",
  });
  await submitEdit(
    authentication.url,
    authentication.token,
    PaywallDesignerDocument.encode([
      {
        ...initial[0],
        name: "Release smoke paywall — edited live",
      },
    ]),
  );

  const thumbnailUrl = await waitFor(
    async () => {
      const value = runPostgres(
        `SELECT thumbnail_url FROM paywall WHERE id = ${quoteSql(paywallId)};`,
        true,
      );
      return value || undefined;
    },
    "Timed out waiting for the paywall thumbnail",
    45_000,
  );
  const thumbnail = await fetch(thumbnailUrl);
  if (!thumbnail.ok) {
    throw new Error(`Paywall thumbnail returned ${thumbnail.status}`);
  }
  if (thumbnail.headers.get("content-type") !== "image/png") {
    throw new Error(`Unexpected thumbnail content type: ${thumbnail.headers.get("content-type")}`);
  }
  const png = new Uint8Array(await thumbnail.arrayBuffer());
  if (
    png.length < 8 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => png[index] === byte)
  ) {
    throw new Error("Paywall thumbnail is not a PNG");
  }

  const release = publishRelease();
  if (
    release.draft.releaseId === release.published.releaseId ||
    release.draft.version !== 1 ||
    release.published.version !== 1
  ) {
    throw new Error(`Unexpected release result: ${JSON.stringify(release)}`);
  }
  runPostgres(`
    INSERT INTO paywall_location (id, project_id, slug, name)
    VALUES (${quoteSql(locationId)}, ${quoteSql(projectId)}, ${quoteSql(
      locationSlug,
    )}, 'Release smoke location');
    INSERT INTO paywall_location_showing (
      id, project_id, paywall_location_id, type, paywall_id,
      paywall_release_id, started_at, created_by_user_id
    ) VALUES (
      ${quoteSql(showingId)}, ${quoteSql(projectId)}, ${quoteSql(locationId)}, 1,
      ${quoteSql(paywallId)}, ${quoteSql(release.published.releaseId)}, NOW(),
      ${quoteSql(releaseUserId)}
    );
  `);
  const sdkRelease = await resolvePaywallThroughSdk();
  if (
    sdkRelease.releaseId !== release.published.releaseId ||
    sdkRelease.htmlUrl !== release.published.htmlUrl ||
    sdkRelease.version !== release.published.version
  ) {
    throw new Error(
      `SDK release did not match the published release: ${JSON.stringify(sdkRelease)}`,
    );
  }
  const publishedHtml = await fetch(sdkRelease.htmlUrl);
  const publishedBody = await publishedHtml.text();
  if (!publishedHtml.ok) {
    throw new Error(`Published paywall returned ${publishedHtml.status}: ${publishedBody}`);
  }
  if (!publishedBody.includes("Release smoke paywall — edited live")) {
    throw new Error("Published paywall did not contain the live-edited document");
  }

  const sentAt = new Date().toISOString();
  const capture = await fetch(`${url}/i/v1/capture`, {
    body: JSON.stringify({
      context: { runtime: "selfhost" },
      distinct_id: `person_release_smoke_${suffix}`,
      event: "selfhost_release_smoke",
      properties: { paywall_id: paywallId },
      sent_at: sentAt,
      timestamp: sentAt,
      token: apiKey,
      uuid: `event_release_smoke_${suffix}`,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const captureBody = await capture.text();
  if (capture.status !== 202) {
    throw new Error(`Event capture returned ${capture.status}: ${captureBody}`);
  }
  const result = JSON.parse(captureBody) as {
    readonly accepted: number;
    readonly rejected: number;
  };
  if (result.accepted !== 1 || result.rejected !== 0) {
    throw new Error(`Unexpected event capture response: ${captureBody}`);
  }
  await waitFor(
    async () => ((await countCapturedEvents()) > 0 ? true : undefined),
    "Timed out waiting for the analytics event in ClickHouse",
  );

  console.log("Self-host release smoke passed");
} finally {
  try {
    if (paywallDocumentCreated) {
      const databaseInfo = (await sdk.listDatabases()).find(
        (database) => database.name === "voidhash",
      );
      if (databaseInfo) {
        const database = sdk.database(
          databaseInfo.id,
          databaseInfo.name,
          databaseInfo.description,
        );
        const collectionInfo = (await database.listCollections()).find(
          (collection) => collection.name === "paywalls",
        );
        if (collectionInfo) {
          await database.collectionRaw(collectionInfo.id).deleteDocument(paywallId);
        }
      }
    }
  } finally {
    await sdk.dispose();
    runPostgres(`
      DELETE FROM paywall_location_showing WHERE id = ${quoteSql(showingId)};
      DELETE FROM paywall_location WHERE id = ${quoteSql(locationId)};
      DELETE FROM paywall_release WHERE paywall_id = ${quoteSql(paywallId)};
      DELETE FROM api_key WHERE id = ${quoteSql(apiKeyId)};
      DELETE FROM person_identity WHERE project_id = ${quoteSql(projectId)};
      DELETE FROM person WHERE project_id = ${quoteSql(projectId)};
      DELETE FROM paywall WHERE id = ${quoteSql(paywallId)};
      DELETE FROM project WHERE id = ${quoteSql(projectId)};
      DELETE FROM platform_queue_messages
      WHERE body_json -> 'envelope' ->> 'projectId' = ${quoteSql(projectId)}
         OR body_json ->> 'documentId' = ${quoteSql(paywallId)};
    `);
  }
}
