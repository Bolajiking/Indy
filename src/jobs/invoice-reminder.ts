import pino from "#logger";
import { getDealsForCreator } from "../db/queries/deals.js";
import { listCreatorsForMorningBriefs } from "../db/queries/creators.js";
import type { DealStage } from "../config/constants.js";
import { sendCreatorMessageToChannels } from "./creator-message.js";
import { runForCreators } from "./run-for-creators.js";
import { formatUsdWhole } from "../lib/format.js";

const log = pino({ name: "jobs:invoice-reminder" });

/** Deals in these stages should have payments tracked. */
const PAYMENT_STAGES = ["active", "completed"] as const;
type PaymentStage = (typeof PAYMENT_STAGES)[number];

/** Days after which an active/completed deal is considered overdue. */
const OVERDUE_THRESHOLD_DAYS = 30;

function isPaymentStage(stage: DealStage): stage is PaymentStage {
  return PAYMENT_STAGES.includes(stage as PaymentStage);
}

export async function runInvoiceReminder(creatorId?: string): Promise<void> {
  await runForCreators(
    creatorId,
    listCreatorsForMorningBriefs,
    checkSingleCreator,
    log,
    "Invoice reminder failed",
  );
}

async function checkSingleCreator(creatorId: string): Promise<void> {
  const deals = await getDealsForCreator(creatorId);
  const now = Date.now();

  const overdueDeals = deals.filter((deal) => {
    if (!isPaymentStage(deal.stage)) return false;

    const updatedAt = new Date(deal.updated_at).getTime();
    const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24);

    const unpaid =
      (deal.estimated_value_cents ?? 0) > 0 && !deal.actual_value_cents;

    return daysSinceUpdate > OVERDUE_THRESHOLD_DAYS && unpaid;
  });

  if (overdueDeals.length === 0) return;

  const message = formatReminderMessage(overdueDeals);
  log.info(
    { creatorId, overdueCount: overdueDeals.length },
    "Sending invoice reminders",
  );

  // Fetch channel ids only after confirming there is a reminder to send.
  const { supabase } = await import("../db/client.js");
  const { data: creator } = await supabase
    .from("creators")
    .select("telegram_chat_id, whatsapp_phone")
    .eq("id", creatorId)
    .single();

  if (!creator) return;

  const outgoing = { text: message, parseMode: "Markdown" as const };

  await sendCreatorMessageToChannels(
    creatorId,
    creator,
    outgoing,
    log,
    "Invoice reminder sent",
  );
}

function formatReminderMessage(
  deals: Array<{
    brand_name: string;
    estimated_value_cents: number | null;
    stage: string;
  }>,
): string {
  let msg = `*Invoice Reminder*\n\nYou have ${deals.length} deal${deals.length === 1 ? "" : "s"} that may need invoicing:\n\n`;

  for (const deal of deals) {
    const value = deal.estimated_value_cents
      ? formatUsdWhole(deal.estimated_value_cents)
      : "TBD";
    msg += `• *${deal.brand_name}* — ${value} [${deal.stage}]\n`;
  }

  msg += `\n_Reply "invoice [brand name]" and I'll help you draft one, or "mark paid [brand name]" to update the record._`;
  return msg;
}
