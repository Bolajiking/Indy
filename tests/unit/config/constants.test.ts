import { describe, expect, it } from "vitest";
import { DEAL_STAGES, isDealStage } from "../../../src/config/constants.js";

describe("deal stage constants", () => {
  it("recognizes every configured deal stage", () => {
    for (const stage of DEAL_STAGES) {
      expect(isDealStage(stage)).toBe(true);
    }
  });

  it("rejects non-stage values without coercion", () => {
    expect(isDealStage("invented")).toBe(false);
    expect(isDealStage("Discovered")).toBe(false);
    expect(isDealStage(null)).toBe(false);
  });
});
