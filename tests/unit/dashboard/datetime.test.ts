import { describe, expect, it } from "vitest";

import {
  formatDashboardDate,
  formatDashboardDateTime,
  formatDashboardNumber,
  formatDashboardTime,
} from "../../../dashboard/src/lib/datetime";

describe("dashboard datetime formatting", () => {
  const iso = "2026-03-21T11:20:00.000Z";

  it("formats dates deterministically", () => {
    expect(formatDashboardDate(iso)).toBe("21 Mar 2026");
  });

  it("formats datetimes deterministically", () => {
    expect(formatDashboardDateTime(iso)).toBe("21 Mar 2026, 11:20 UTC");
  });

  it("formats times deterministically", () => {
    expect(formatDashboardTime(iso)).toBe("11:20 UTC");
  });

  it("formats numbers deterministically", () => {
    expect(formatDashboardNumber(1234567)).toBe("1,234,567");
  });
});
