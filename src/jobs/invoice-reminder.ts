import pino from "pino";
import { getDealsForCreator } from "../db/queries/deals.js";
import { listCreatorsForMorningBriefs } from "../db/queries/creators.js";
import { sendMessageToCreator } from "../bot/telegram.js";
import { sendWhatsAppMessage } from "../bot/whatsapp.js";

const log = pino({ name: "jobs:invoice-reminder" });

/** Deals in these stages should have payments tracked. */
const PAYMENT_STAGES = ["active", "completed"] as const;

/** Days after which an active/completed deal is considered overdue. */
const OVERDUE_THRESHOLD_DAYS = 30;

export async function runInvoiceReminder(creatorId?: string): Promise<void> {
  if (creatorId) {
    await checkSingleCreator(creatorId);
    return;
  }

  const creators = await listCreatorsForMorningBriefs();
  for (const creator of creators) {
    try {
      await checkSingleCreator(creator.id);
    } catch (error) {
      log.error({ creatorId: creator.id, error }, "Invoice reminder failed");
    }
  }
}

async function checkSingleCreator(creatorId: string): Promise<void> {
  const deals = await getDealsForCreator(creatorId);
  const now = Date.now();

  const overdueDeals = deals.filter((deal) => {
    if (!PAYMENT_STAGES.includes(deal.stage as any)) return false;

    // Check if deal has been in a payment stage for longer than threshold
    const updatedAt = new Date(deal.updated_at).getTime();
    const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24);

    // Only flag deals that have an expected value but no actual value recorded
    const unpaid = (deal.estimated_value_cents ?? 0) > 0 && !deal.actual_value_cents;

    return daysSinceUpdate > OVERDUE_THRESHOLD_DAYS && unpaid;
  });

  if (overdueDeals.length === 0) return;

  const message = formatReminderMessage(overdueDeals);
  log.info(
    { creatorId, overdueCount: overdueDeals.length },
    "Sending invoice reminders"
  );

  // Look up creator to find their platform
  const { supabase } = await import("../db/client.js");
  const { data: creator } = await supabase
    .from("creators")
    .select("telegram_chat_id, whatsapp_phone")
    .eq("id", creatorId)
    .single();

  if (!creator) return;

  const outgoing = { text: message, parseMode: "Markdown" as const };

  if (creator.telegram_chat_id) {
    await sendMessageToCreator(creator.telegram_chat_id, outgoing);
    log.info({ creatorId, platform: "telegram" }, "Invoice reminder sent");
  }

  if (creator.whatsapp_phone) {
    await sendWhatsAppMessage(creator.whatsapp_phone, outgoing);
    log.info({ creatorId, platform: "whatsapp" }, "Invoice reminder sent");
  }
}

function formatReminderMessage(
  deals: Array<{
    brand_name: string;
    estimated_value_cents: number | null;
    stage: string;
  }>
): string {
  let msg = `*Invoice Reminder*\n\nYou have ${deals.length} deal${deals.length === 1 ? "" : "s"} that may need invoicing:\n\n`;

  for (const deal of deals) {
    const value = deal.estimated_value_cents
      ? `$${(deal.estimated_value_cents / 100).toFixed(0)}`
      : "TBD";
    msg += `• *${deal.brand_name}* — ${value} [${deal.stage}]\n`;
  }

  msg += `\n_Reply "invoice [brand name]" and I'll help you draft one, or "mark paid [brand name]" to update the record._`;
  return msg;
}
