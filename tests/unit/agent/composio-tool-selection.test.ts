import { describe, expect, it } from "vitest";
import { selectToolkitTools } from "../../../src/integrations/composio.js";

const slugs = (tools: { slug?: string }[]) => tools.map((t) => t.slug ?? "");

describe("selectToolkitTools", () => {
  it("keeps core reads AND core writes, drops obscure admin actions", () => {
    // A Gmail-like catalog where obscure admin reads outnumber everything.
    const catalog = [
      { slug: "GMAIL_FETCH_EMAILS" },
      { slug: "GMAIL_LIST_MESSAGES" },
      { slug: "GMAIL_SEND_EMAIL" },
      { slug: "GMAIL_CREATE_EMAIL_DRAFT" },
      { slug: "GMAIL_REPLY_TO_THREAD" },
      // obscure admin reads that must NOT crowd out the writes above
      { slug: "GMAIL_LIST_CSE_KEYPAIRS" },
      { slug: "GMAIL_LIST_CSE_IDENTITIES" },
      { slug: "GMAIL_GET_VACATION_SETTINGS" },
      { slug: "GMAIL_GET_AUTO_FORWARDING" },
      { slug: "GMAIL_LIST_FORWARDING_ADDRESSES" },
      { slug: "GMAIL_LIST_FILTERS" },
      { slug: "GMAIL_GET_LANGUAGE_SETTINGS" },
    ];
    // Cap == the 5 core tools: obscure admin actions must be the ones squeezed
    // out, never a core read or write.
    const picked = slugs(selectToolkitTools(catalog, 5));
    expect(picked).toContain("GMAIL_FETCH_EMAILS");
    expect(picked).toContain("GMAIL_SEND_EMAIL");
    expect(picked).toContain("GMAIL_CREATE_EMAIL_DRAFT");
    expect(picked).toContain("GMAIL_REPLY_TO_THREAD");
    // obscure admin actions are excluded when core tools fill the cap
    expect(picked).not.toContain("GMAIL_LIST_CSE_KEYPAIRS");
    expect(picked).not.toContain("GMAIL_GET_VACATION_SETTINGS");
  });

  it("surfaces analytics/read tools that the curated default omits", () => {
    const catalog = [
      { slug: "YOUTUBE_LIST_COMMENTS" },
      { slug: "YOUTUBE_GET_CHANNEL_STATISTICS" },
      { slug: "YOUTUBE_LIST_CHANNEL_VIDEOS" },
      { slug: "YOUTUBE_GET_CHANNEL_ID_BY_HANDLE" },
      { slug: "YOUTUBE_POST_COMMENT" },
      { slug: "YOUTUBE_UPLOAD_VIDEO" },
    ];
    const picked = slugs(selectToolkitTools(catalog, 6));
    expect(picked).toContain("YOUTUBE_GET_CHANNEL_STATISTICS");
    expect(picked).toContain("YOUTUBE_LIST_CHANNEL_VIDEOS");
    expect(picked).toContain("YOUTUBE_POST_COMMENT");
  });

  it("drops deprecated tools and respects the cap", () => {
    const catalog = [
      { slug: "A_GET_THING", isDeprecated: true },
      { slug: "A_LIST_THINGS" },
      { slug: "A_CREATE_THING" },
    ];
    const picked = slugs(selectToolkitTools(catalog, 10));
    expect(picked).not.toContain("A_GET_THING");
    expect(picked.length).toBe(2);
  });

  it("never exceeds the requested limit", () => {
    const catalog = Array.from({ length: 40 }, (_, i) => ({
      slug: `APP_GET_ITEM_${i}`,
    }));
    expect(selectToolkitTools(catalog, 12)).toHaveLength(12);
  });
});
