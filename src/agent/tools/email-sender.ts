import { registerTool, type AgentTool } from "./registry.js";

const sendEmailTool: AgentTool = {
  name: "send_email",
  description:
    "Send an email on behalf of the creator (e.g., pitch emails to brands). Requires creator approval before sending. Uses StableEmail via MPP.",
  autonomyLevel: "hybrid",
  costCategory: "mpp",
  maxCostPerUseCents: 50,
  parameters: {
    to: {
      type: "string",
      description: "Recipient email address",
      required: true,
    },
    subject: {
      type: "string",
      description: "Email subject line",
      required: true,
    },
    body: {
      type: "string",
      description: "Email body (plain text or HTML)",
      required: true,
    },
    from_name: {
      type: "string",
      description: "Sender display name (creator's name)",
      required: true,
    },
  },
  async execute(params, context) {
    const { to, subject, body, from_name } = params as {
      to: string;
      subject: string;
      body: string;
      from_name: string;
    };

    try {
      const response = await context.mppFetch(
        "https://stableemail.dev/api/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            subject,
            body,
            from_name,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          data: null,
          error: `Email send failed: ${response.status} - ${errorText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: { message: `Email sent to ${to}`, result: data },
        costCents: 25,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : "Unknown error sending email",
      };
    }
  },
};

registerTool(sendEmailTool);
