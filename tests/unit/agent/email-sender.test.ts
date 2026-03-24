import { describe, it, expect, vi } from "vitest";
import { getAllTools } from "../../../src/agent/tools/registry.js";

// Import the tool to register it
import "../../../src/agent/tools/email-sender.js";

describe("send_email tool", () => {
  it("is registered in the tool registry", () => {
    const tools = getAllTools();
    const emailTool = tools.find((t) => t.name === "send_email");
    expect(emailTool).toBeDefined();
  });

  it("is a hybrid tool requiring approval", () => {
    const tools = getAllTools();
    const emailTool = tools.find((t) => t.name === "send_email")!;
    expect(emailTool.autonomyLevel).toBe("hybrid");
    expect(emailTool.costCategory).toBe("mpp");
  });

  it("requires to, subject, body, and from_name parameters", () => {
    const tools = getAllTools();
    const emailTool = tools.find((t) => t.name === "send_email")!;
    expect(emailTool.parameters.to.required).toBe(true);
    expect(emailTool.parameters.subject.required).toBe(true);
    expect(emailTool.parameters.body.required).toBe(true);
    expect(emailTool.parameters.from_name.required).toBe(true);
  });
});
