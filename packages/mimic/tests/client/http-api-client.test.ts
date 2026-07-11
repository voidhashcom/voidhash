import { describe, expect, it, vi } from "vitest";

import { MimicDbHttpClient } from "../../src/client/HttpApiClient.js";
import { makeValue } from "../helpers.js";

describe("MimicDbHttpClient", () => {
  it("uses basic auth and document routes from mimic-db", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "doc-1",
            collectionId: "col-1",
            value: makeValue("Title"),
            version: 1,
          }),
          {
            status: 201,
            headers: { "content-type": "application/json" },
          },
        ),
    );

    const client = new MimicDbHttpClient({
      baseUrl: "https://example.com",
      auth: {
        username: "user",
        password: "pass",
      },
      fetch,
    });

    const response = await client.createDocument({
      collectionId: "col-1",
      value: makeValue("Title"),
    });

    expect(response.value).toEqual(makeValue("Title"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe("https://example.com/api/v1/collections/col-1/documents");
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Headers).get("authorization")).toMatch(/^Basic /);
  });
});
