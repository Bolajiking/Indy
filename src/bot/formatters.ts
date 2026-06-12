import type { ScanResult } from "../agent/skills/brand-deal-scanner.js";
import type { ContractReview } from "../agent/skills/contract-reviewer.js";
import type { MorningBrief } from "../agent/skills/morning-brief.js";
import type { RateCard } from "../agent/skills/rate-calculator.js";
import { formatUsdWhole } from "../lib/format.js";

export function formatMorningBrief(brief: MorningBrief): string {
  let message = `${brief.greeting}\n\n`;

  for (const item of brief.items) {
    message += `${item.emoji} *${item.title}*\n${item.detail}\n_${item.actionPrompt}_\n\n`;
  }

  message += `---\n${brief.closingNote}`;
  return message;
}

export function formatRateCard(rates: RateCard[]): string {
  if (rates.length === 0) {
    return 'I can\'t build your rate card yet — I need at least one connected platform to see your real stats. Say "connect my YouTube" (or Instagram/TikTok) and I\'ll set it up, then calculate your rates right away.';
  }

  let message = "*Your Rate Card*\n\n";

  for (const rate of rates) {
    message += `*${rate.platform} — ${rate.contentType}*\n`;
    message += `Recommended: *${formatUsdWhole(rate.recommendedRateCents)}*\n`;
    message += `Range: ${formatUsdWhole(rate.rangeLowCents)} - ${formatUsdWhole(rate.rangeHighCents)}\n`;
    message += `_${rate.reasoning}_\n\n`;
  }

  return message;
}

export function formatScanResults(results: ScanResult): string {
  if (results.opportunities.length === 0) {
    return "No new opportunities found this scan. I'll keep looking.";
  }

  let message = `*Found ${results.opportunities.length} opportunities:*\n\n`;

  for (const opportunity of results.opportunities) {
    message += `*${opportunity.brandName}* — Fit: ${opportunity.fitScore}/100\n`;
    message += `Est. value: *${formatUsdWhole(opportunity.estimatedValueCents)}*\n`;
    message += `${opportunity.reason}\n\n`;
  }

  message += `_Reply with a brand name to pitch them, or say "pitch all" to let me draft pitches for all._`;
  return message;
}

export function formatContractReview(review: ContractReview): string {
  const riskEmoji = { low: "🟢", medium: "🟡", high: "🔴" };

  let message = `*Contract Review* ${riskEmoji[review.overallRisk]} Risk: *${review.overallRisk.toUpperCase()}*\n\n`;
  message += `${review.summary}\n\n`;

  if (review.issues.length > 0) {
    message += "*Issues Found:*\n";
    for (const issue of review.issues) {
      const icon =
        issue.severity === "critical"
          ? "🔴"
          : issue.severity === "warning"
            ? "🟡"
            : "ℹ️";
      message += `${icon} *${issue.issue}*\n`;
      message += `_"${issue.clause.slice(0, 80)}${issue.clause.length > 80 ? "..." : ""}"_\n`;
      message += `→ ${issue.suggestion}\n\n`;
    }
  }

  if (review.missingClauses.length > 0) {
    message += "*Missing Clauses:*\n";
    for (const clause of review.missingClauses) {
      message += `⚠️ ${clause}\n`;
    }
    message += "\n";
  }

  if (review.recommendedChanges.length > 0) {
    message += "*Recommended Changes:*\n";
    for (const change of review.recommendedChanges) {
      message += `• ${change}\n`;
    }
  }

  return message;
}
