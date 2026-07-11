import pino from "#logger";
import { getDealsForCreator } from "../../db/queries/deals.js";
import { formatUsdWhole } from "../../lib/format.js";

const log = pino({ name: "skill:calendar-manager" });

export interface CalendarEvent {
  title: string;
  date: string;
  type: "deadline" | "meeting" | "content" | "payment" | "milestone";
  dealId?: string;
  brandName?: string;
  priority: "high" | "medium" | "low";
  notes?: string;
}

export interface CalendarView {
  creatorId: string;
  generatedAt: string;
  upcoming: CalendarEvent[];
  overdue: CalendarEvent[];
}

/**
 * Generates a calendar view of upcoming deadlines, content dates,
 * and payment milestones based on the creator's deal pipeline.
 */
export async function getCalendarView(
  creatorId: string,
): Promise<CalendarView> {
  log.info({ creatorId }, "Generating calendar view");

  const deals = await getDealsForCreator(creatorId);
  const now = new Date();
  const upcoming: CalendarEvent[] = [];
  const overdue: CalendarEvent[] = [];

  for (const deal of deals) {
    if (deal.stage === "completed" || deal.stage === "lost") continue;

    const updatedAt = new Date(deal.updated_at);
    const daysSinceUpdate =
      (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (deal.stage === "discovered") {
      const event: CalendarEvent = {
        title: `Pitch ${deal.brand_name}`,
        date: addDays(updatedAt, 3).toISOString().slice(0, 10),
        type: "deadline",
        dealId: deal.id,
        brandName: deal.brand_name,
        priority: deal.fit_score && deal.fit_score > 70 ? "high" : "medium",
        notes: `Fit score: ${deal.fit_score ?? "N/A"}`,
      };
      if (daysSinceUpdate > 3) {
        overdue.push(event);
      } else {
        upcoming.push(event);
      }
    }

    if (deal.stage === "pitched") {
      const event: CalendarEvent = {
        title: `Follow up with ${deal.brand_name}`,
        date: addDays(updatedAt, 5).toISOString().slice(0, 10),
        type: "deadline",
        dealId: deal.id,
        brandName: deal.brand_name,
        priority: "medium",
      };
      if (daysSinceUpdate > 5) {
        overdue.push(event);
      } else {
        upcoming.push(event);
      }
    }

    if (deal.stage === "negotiating" || deal.stage === "contracted") {
      const event: CalendarEvent = {
        title: `Finalize ${deal.brand_name} contract`,
        date: addDays(updatedAt, 7).toISOString().slice(0, 10),
        type: "milestone",
        dealId: deal.id,
        brandName: deal.brand_name,
        priority: "high",
        notes: deal.estimated_value_cents
          ? `Value: ${formatUsdWhole(deal.estimated_value_cents)}`
          : undefined,
      };
      if (daysSinceUpdate > 7) {
        overdue.push(event);
      } else {
        upcoming.push(event);
      }
    }

    if (deal.stage === "active") {
      // Active deals get inferred delivery and invoice checkpoints when no explicit dates exist.
      upcoming.push({
        title: `Deliver content for ${deal.brand_name}`,
        date: addDays(updatedAt, 14).toISOString().slice(0, 10),
        type: "content",
        dealId: deal.id,
        brandName: deal.brand_name,
        priority: "high",
      });

      if (!deal.actual_value_cents) {
        upcoming.push({
          title: `Invoice ${deal.brand_name}`,
          date: addDays(updatedAt, 30).toISOString().slice(0, 10),
          type: "payment",
          dealId: deal.id,
          brandName: deal.brand_name,
          priority: "medium",
          notes: deal.estimated_value_cents
            ? `Expected: ${formatUsdWhole(deal.estimated_value_cents)}`
            : undefined,
        });
      }
    }
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  overdue.sort((a, b) => a.date.localeCompare(b.date));

  log.info(
    { creatorId, upcoming: upcoming.length, overdue: overdue.length },
    "Calendar view generated",
  );

  return {
    creatorId,
    generatedAt: now.toISOString(),
    upcoming,
    overdue,
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
