import { AGENT } from "../../config/constants.js";
import { getDealById, updateDealStage } from "../../db/queries/deals.js";
import anthropic from "../anthropic.js";
import pino from "pino";

const log = pino({ name: "skill:contract-reviewer" });

export interface ContractIssue {
  severity: "critical" | "warning" | "info";
  clause: string;
  issue: string;
  suggestion: string;
}

export interface ContractReview {
  summary: string;
  overallRisk: "low" | "medium" | "high";
  issues: ContractIssue[];
  missingClauses: string[];
  recommendedChanges: string[];
}

export async function reviewContract(
  creatorId: string,
  contractText: string,
  dealId?: string
): Promise<ContractReview> {
  log.info({ creatorId, dealId }, "Reviewing contract");

  let dealContext = "";
  if (dealId) {
    const deal = await getDealById(dealId);
    if (deal) {
      dealContext = `\nDeal context: ${deal.brand_name}, estimated value $${((deal.estimated_value_cents ?? 0) / 100).toFixed(0)}, stage: ${deal.stage}`;
    }
  }

  const response = await anthropic.messages.create({
    model: AGENT.DEFAULT_LLM,
    max_tokens: 3000,
    system: `You are a contract review specialist for content creators. Analyze brand deal contracts and flag issues that could harm the creator.

Key areas to check:
- **Exclusivity clauses** — are they too broad or too long?
- **Payment terms** — net-30 is standard; net-90+ is a red flag
- **Usage rights** — perpetual or unlimited usage rights are red flags
- **Content approval** — does the brand have veto power over creative?
- **Deliverable scope** — are revisions capped? Is scope clear?
- **Termination** — can the brand terminate without paying?
- **Non-compete** — does it prevent working with similar brands?
- **Liability/indemnification** — is the creator taking on too much risk?
- **FTC compliance** — does it require proper disclosure?

Return ONLY valid JSON:
{
  "summary": "2-3 sentence overview of the contract",
  "overallRisk": "low|medium|high",
  "issues": [
    { "severity": "critical|warning|info", "clause": "relevant text", "issue": "what's wrong", "suggestion": "what to change" }
  ],
  "missingClauses": ["list of important clauses not present"],
  "recommendedChanges": ["specific change suggestions"]
}`,
    messages: [
      {
        role: "user",
        content: `Review this contract for a content creator:${dealContext}\n\n---\n${contractText}\n---`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const review = JSON.parse(text) as ContractReview;

    if (dealId) {
      await updateDealStage(dealId, "negotiating", {
        contract_notes: review.summary,
        metadata: { contractReview: review },
      });
    }

    log.info(
      { creatorId, risk: review.overallRisk, issues: review.issues.length },
      "Contract review complete"
    );
    return review;
  } catch {
    log.error({ creatorId, text }, "Failed to parse contract review");
    return {
      summary: "Could not analyze the contract. Please try pasting it again.",
      overallRisk: "high",
      issues: [],
      missingClauses: [],
      recommendedChanges: [],
    };
  }
}
