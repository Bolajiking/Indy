import { describe, expect, it } from "vitest";

import {
  getProfileSaveErrorCopy,
  getRegistrationErrorCopy,
  isCreatorServiceOutage,
} from "../../../dashboard/src/lib/onboarding-errors";

describe("onboarding error helpers", () => {
  it("detects creator service outages", () => {
    expect(
      isCreatorServiceOutage(
        "Creator service is temporarily unavailable. Please retry in a moment."
      )
    ).toBe(true);
    expect(isCreatorServiceOutage("Registration failed")).toBe(false);
  });

  it("returns friendlier onboarding copy for registration outages", () => {
    expect(
      getRegistrationErrorCopy(
        "Creator service is temporarily unavailable. Please retry in a moment."
      )
    ).toContain("Sign-in worked");
  });

  it("returns friendlier onboarding copy for profile save outages", () => {
    expect(
      getProfileSaveErrorCopy(
        "Creator service is temporarily unavailable. Please retry in a moment."
      )
    ).toContain("Profile save");
  });
});
