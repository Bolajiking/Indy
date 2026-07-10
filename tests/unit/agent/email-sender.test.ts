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

  it("builds a complete cost-bound preview without exposing secrets", () => {
    const tool = getAllTools().find((t) => t.name === "send_email")!;
    const preview = tool.buildApprovalPreview?.({
      to: "brand@example.com",
      subject: "Pitch",
      body: "Hello",
      from_name: "Creator",
      authorization_token: "secret",
    });

    expect(preview).toMatchObject({
      service: "stableemail",
      operation: "send_email",
      target: "brand@example.com",
      maxCostCents: 50,
    });
    expect(preview?.materialArguments?.authorization_token).toBe("[redacted]");
  });

  it("removes URL credentials and query secrets from preview targets and arguments", async () => {
    const { inferActionTarget, sanitizeMaterialArguments } =
      await import("../../../src/agent/action-preview.js");
    const input = {
      webhook_url:
        "https://user:pass@hooks.example.com/delivery?token=raw-secret#fragment",
      message: "publish",
    };

    expect(inferActionTarget(input)).toBe("https://hooks.example.com/delivery");
    expect(sanitizeMaterialArguments(input).webhook_url).toBe(
      "https://hooks.example.com/delivery",
    );

    const multiple = {
      recipients: [
        "https://hooks.example.com/one?sig=secret-one",
        "https://hooks.example.com/two?sig=secret-two",
      ],
    };
    expect(inferActionTarget(multiple)).toBe(
      "https://hooks.example.com/one, https://hooks.example.com/two",
    );
    expect(sanitizeMaterialArguments(multiple).recipients).toEqual([
      "https://hooks.example.com/one",
      "https://hooks.example.com/two",
    ]);
  });
});
