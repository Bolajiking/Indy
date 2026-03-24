import { describe, expect, it } from "vitest";

import { shouldShowDebugAccessTokenPanel } from "../../../dashboard/src/lib/debug-auth";

describe("shouldShowDebugAccessTokenPanel", () => {
  it("shows the panel only in development for signed-in creator stages with a token", () => {
    expect(
      shouldShowDebugAccessTokenPanel({
        nodeEnv: "development",
        authenticated: true,
        stage: "active",
        accessToken: "token-123",
      })
    ).toBe(true);

    expect(
      shouldShowDebugAccessTokenPanel({
        nodeEnv: "development",
        authenticated: true,
        stage: "wallet_pending",
        accessToken: "token-123",
      })
    ).toBe(true);

    expect(
      shouldShowDebugAccessTokenPanel({
        nodeEnv: "development",
        authenticated: true,
        stage: "unregistered",
        accessToken: "token-123",
      })
    ).toBe(true);
  });

  it("hides the panel outside development", () => {
    expect(
      shouldShowDebugAccessTokenPanel({
        nodeEnv: "production",
        authenticated: true,
        stage: "active",
        accessToken: "token-123",
      })
    ).toBe(false);
  });

  it("hides the panel when there is no access token or creator access", () => {
    expect(
      shouldShowDebugAccessTokenPanel({
        nodeEnv: "development",
        authenticated: true,
        stage: "active",
        accessToken: "",
      })
    ).toBe(false);

    expect(
      shouldShowDebugAccessTokenPanel({
        nodeEnv: "development",
        authenticated: false,
        stage: "signed_out",
        accessToken: "token-123",
      })
    ).toBe(false);
  });
});
