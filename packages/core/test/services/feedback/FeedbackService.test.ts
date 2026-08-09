import { describe, expect, it } from "vite-plus/test";

import { buildSlackMessage } from "../../../src/services/feedback/FeedbackService.ts";

/**
 * Pure Slack-payload assembly of `FeedbackService`. The DB write + session
 * context resolution + best-effort relay are exercised by the integration
 * suite; here we lock down the Block Kit shape and the conditional context
 * lines so a missing org/project/page/sentiment never emits an empty field.
 */

/** The context block is the only Block Kit variant carrying `elements`. */
type ContextBlock = { readonly elements: ReadonlyArray<{ readonly text: string }> };
const isContextBlock = (block: object): block is ContextBlock => "elements" in block;
const contextTextOf = (block: object): string => {
  if (isContextBlock(block)) return block.elements[0].text;
  return "";
};

const base = {
  topicLabel: "Analytics",
  message: "The revenue chart is blank",
  userName: "Jane Doe",
  userEmail: "jane@acme.com",
};

describe("buildSlackMessage", () => {
  it("assembles a header, message, and context block", () => {
    const { blocks, text } = buildSlackMessage({
      ...base,
      sentimentLabel: "Unhappy",
      organizationName: "Acme",
      projectName: "Mobile",
      pathname: "/studio/acme/mobile/analytics/revenue",
    });

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: "header" });
    expect(blocks[1]).toMatchObject({ type: "section" });
    expect(blocks[2]).toMatchObject({ type: "context" });

    const contextText = contextTextOf(blocks[2]);
    expect(contextText).toContain("Jane Doe");
    expect(contextText).toContain("jane@acme.com");
    expect(contextText).toContain("Acme");
    expect(contextText).toContain("Mobile");
    expect(contextText).toContain("/studio/acme/mobile/analytics/revenue");
    expect(contextText).toContain("Unhappy");

    // The notification fallback text carries topic, submitter, and message.
    expect(text).toContain("Analytics");
    expect(text).toContain("jane@acme.com");
    expect(text).toContain("The revenue chart is blank");
  });

  it("omits context lines for absent org/project/page/sentiment", () => {
    const { blocks } = buildSlackMessage({
      ...base,
      sentimentLabel: null,
      organizationName: null,
      projectName: null,
      pathname: null,
    });

    const contextText = contextTextOf(blocks[2]);
    expect(contextText).toContain("Jane Doe");
    expect(contextText).not.toContain("Organization:");
    expect(contextText).not.toContain("Project:");
    expect(contextText).not.toContain("Page:");
    expect(contextText).not.toContain("Sentiment:");
  });
});
