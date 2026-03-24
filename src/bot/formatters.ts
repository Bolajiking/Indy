import type { ScanResult } from "../agent/skills/brand-deal-scanner.js";
import type { ContractReview } from "../agent/skills/contract-reviewer.js";
import type { ContentStrategyReport } from "../agent/skills/content-strategy.js";
import type { FinancialSnapshot } from "../agent/skills/financial-tracker.js";
import type { MorningBrief } from "../agent/skills/morning-brief.js";
import type { RateCard } from "../agent/skills/rate-calculator.js";
import type { RevenueAdvisorReport } from "../agent/skills/revenue-advisor.js";

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
    return "Couldn't calculate rates. Connect a platform first so I can see your stats.";
  }

  let message = "*Your Rate Card*\n\n";

  for (const rate of rates) {
    message += `*${rate.platform} — ${rate.contentType}*\n`;
    message += `Recommended: *$${(rate.recommendedRateCents / 100).toFixed(0)}*\n`;
    message += `Range: $${(rate.rangeLowCents / 100).toFixed(0)} - $${(rate.rangeHighCents / 100).toFixed(0)}\n`;
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
    message += `Est. value: *$${(opportunity.estimatedValueCents / 100).toFixed(0)}*\n`;
    message += `${opportunity.reason}\n\n`;
  }

  message += `_Reply with a brand name to pitch them, or say "pitch all" to let me draft pitches for all._`;
  return message;
}

export function formatDealCount(active: number, total: number): string {
  return `You have *${active}* active deals out of *${total}* total in your pipeline.`;
}

export function formatWalletBalance(
  freeCredits: number,
  address: string | null
): string {
  let message = "*Wallet*\n";
  message += `Free credits: *$${(freeCredits / 100).toFixed(2)}*\n`;

  if (address) {
    message += `Address: \`${address.slice(0, 8)}...${address.slice(-6)}\`\n`;
    message += "Network: Tempo\n";
  } else {
    message += "_No wallet created yet. Say \"create wallet\" to get started._";
  }

  return message;
}

export function formatContractReview(review: ContractReview): string {
  const riskEmoji = { low: "🟢", medium: "🟡", high: "🔴" };

  let message = `*Contract Review* ${riskEmoji[review.overallRisk]} Risk: *${review.overallRisk.toUpperCase()}*\n\n`;
  message += `${review.summary}\n\n`;

  if (review.issues.length > 0) {
    message += "*Issues Found:*\n";
    for (const issue of review.issues) {
      const icon = issue.severity === "critical" ? "🔴" : issue.severity === "warning" ? "🟡" : "ℹ️";
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

export function formatRevenueReport(report: RevenueAdvisorReport): string {
  const formatUsd = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  let message = `*Revenue Report*\n\n${report.summary}\n\n`;
  message += `Total estimated monthly: *${formatUsd(report.totalEstimatedMonthlyCents)}*\n\n`;

  if (report.currentStreams.length > 0) {
    message += "*Current Streams:*\n";
    for (const stream of report.currentStreams) {
      const trend = stream.trend === "growing" ? "📈" : stream.trend === "declining" ? "📉" : "➡️";
      message += `${trend} ${stream.source}: ${formatUsd(stream.estimatedMonthlyCents)}/mo\n`;
    }
    message += "\n";
  }

  if (report.suggestions.length > 0) {
    message += "*Suggestions:*\n";
    for (const s of report.suggestions.slice(0, 3)) {
      message += `• *${s.title}* (${s.effort} effort) — est. ${formatUsd(s.estimatedMonthlyCents)}/mo\n`;
    }
    message += "\n";
  }

  message += `_Risk: ${report.riskAssessment}_`;
  return message;
}

export function formatFinancialSnapshot(snapshot: FinancialSnapshot): string {
  const formatUsd = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  let message = `*Financial Snapshot — ${snapshot.period}*\n\n`;
  message += `Income: *${formatUsd(snapshot.income.totalCents)}*\n`;
  message += `Expenses: *${formatUsd(snapshot.expenses.totalCents)}* (agent: ${formatUsd(snapshot.expenses.agentSpendCents)})\n`;
  message += `Net: *${formatUsd(snapshot.netCents)}*\n\n`;
  message += `Pipeline: ${snapshot.pipeline.activeDealCount} active deals worth ${formatUsd(snapshot.pipeline.totalPipelineValueCents)}\n`;
  message += `Forecast: ${formatUsd(snapshot.forecast.nextMonthEstimateCents)}/mo (${snapshot.forecast.confidence} confidence)`;
  return message;
}

export function formatContentStrategy(strategy: ContentStrategyReport): string {
  let message = `*Content Strategy*\n\n`;
  message += `${strategy.summary}\n\n`;
  message += `Theme: *${strategy.weeklyTheme}*\n\n`;

  for (const idea of strategy.ideas.slice(0, 5)) {
    message += `• *${idea.title}* — ${idea.platform} (${idea.format})`;
    if (idea.tieIn) message += ` 🤝 ${idea.tieIn}`;
    message += `\n`;
  }

  if (Object.keys(strategy.bestPostingTimes).length > 0) {
    message += `\n*Best times:* `;
    message += Object.entries(strategy.bestPostingTimes)
      .map(([p, t]) => `${p}: ${t}`)
      .join(", ");
    message += "\n";
  }

  if (strategy.trendOpportunities.length > 0) {
    message += `\n*Trends:* ${strategy.trendOpportunities.slice(0, 3).join(", ")}`;
  }

  return message;
}
