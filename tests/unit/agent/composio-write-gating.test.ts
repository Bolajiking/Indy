import { describe, expect, it } from "vitest";
import {
  isComposioWriteSlug,
  serializeToolResult,
} from "../../../src/integrations/composio.js";

describe("serializeToolResult", () => {
  it("passes small results through unchanged", () => {
    const data = { messages: [{ subject: "Hi", from: "a@b.com" }] };
    expect(serializeToolResult(data)).toBe(JSON.stringify(data));
  });

  it("clamps oversized payloads while keeping EVERY list item (no count drift)", () => {
    // Simulate GMAIL_FETCH_EMAILS returning 10 huge message bodies. The clamp
    // must keep all 10 — dropping the tail is what made the agent claim "10
    // emails" while only summarizing 3.
    const data = {
      messages: Array.from({ length: 10 }, (_, i) => ({
        subject: `Email ${i}`,
        from: `sender${i}@example.com`,
        messageText: "x".repeat(20000), // huge body + base64-like blob
      })),
    };
    const raw = JSON.stringify(data).length;
    const out = serializeToolResult(data);
    expect(raw).toBeGreaterThan(150_000);
    expect(out.length).toBeLessThanOrEqual(40_100);
    // All 10 items must survive (just with trimmed bodies).
    for (let i = 0; i < 10; i++) {
      expect(out).toContain(`Email ${i}`);
      expect(out).toContain(`sender${i}@example.com`);
    }
  });

  it("truncates long individual string fields but keeps siblings", () => {
    const out = serializeToolResult({
      subject: "Quarterly report",
      body: "y".repeat(5000),
    });
    expect(out).toContain("Quarterly report");
    expect(out).toContain("truncated");
  });

  it("caps long arrays and notes the omission", () => {
    const out = serializeToolResult({
      items: Array.from({ length: 100 }, (_, i) => `item-${i}`),
    });
    expect(out).toContain("item-0");
    expect(out).toContain("more items omitted");
    expect(out).not.toContain("item-99");
  });
});

describe("isComposioWriteSlug", () => {
  it("treats read actions as autonomous (no approval)", () => {
    for (const slug of [
      "GMAIL_FETCH_EMAILS",
      "GMAIL_LIST_MESSAGES",
      "SLACK_SEARCH_MESSAGES",
      "GITHUB_GET_REPO",
      "GOOGLECALENDAR_EVENTS_LIST",
      "NOTION_RETRIEVE_PAGE",
    ]) {
      expect(isComposioWriteSlug(slug)).toBe(false);
    }
  });

  it("treats write/destructive actions as requiring approval", () => {
    for (const slug of [
      "GMAIL_SEND_EMAIL",
      "SLACK_SEND_MESSAGE",
      "GITHUB_CREATE_ISSUE",
      "NOTION_CREATE_PAGE",
      "GOOGLECALENDAR_CREATE_EVENT",
      "GMAIL_DELETE_MESSAGE",
      "SOME_UNKNOWN_ACTION",
    ]) {
      expect(isComposioWriteSlug(slug)).toBe(true);
    }
  });

  it("gives mutation verbs precedence in mixed read/write slugs", () => {
    for (const slug of [
      "CONTACTS_GET_OR_CREATE",
      "NOTION_FIND_OR_CREATE_PAGE",
      "GMAIL_GET_AND_UPDATE_MESSAGE",
      "CALENDAR_SEARCH_OR_DELETE_EVENT",
      "FILES_LIST_AND_MOVE",
      "SOME_GET_OR_PUBLISH_ACTION",
      "CREATE_AND_GET_RESOURCE",
    ]) {
      expect(isComposioWriteSlug(slug)).toBe(true);
    }
  });
});
