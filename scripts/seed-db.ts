import { createCreator } from "../src/db/queries/creators.js";
import { createDeal } from "../src/db/queries/deals.js";
import { logTransaction } from "../src/db/queries/transactions.js";
import { saveMessage } from "../src/db/queries/messages.js";
import { upsertConnection } from "../src/db/queries/platform-connections.js";

async function seed() {
  console.log("Seeding database...\n");

  // --- Creator 1: Telegram-based finance creator ---
  const creator1 = await createCreator({
    display_name: "Ada Finance",
    telegram_chat_id: "test_ada_123",
    niche: "personal finance",
    wallet_id: "test-wallet-ada",
    wallet_address: "0xAda0000000000000000000000000000000000001",
    free_credits_remaining_cents: 800,
    monthly_spend_cents: 200,
    settings: {},
  });
  console.log(`Created creator 1: ${creator1.id} (${creator1.display_name})`);

  // Creator 1 deals at various stages
  await createDeal({
    creator_id: creator1.id,
    brand_name: "NordVPN",
    brand_contact_email: "partnerships@nordvpn.com",
    fit_score: 85,
    estimated_value_cents: 250000,
    stage: "discovered",
    notes: "Strong fit for security-minded finance content.",
  });
  await createDeal({
    creator_id: creator1.id,
    brand_name: "Wealthfront",
    brand_contact_email: "creators@wealthfront.com",
    fit_score: 92,
    estimated_value_cents: 350000,
    stage: "pitched",
    pitch_text: "Hey Wealthfront team, I'd love to feature your platform...",
    notes: "Great investing-app fit for a finance audience.",
  });
  await createDeal({
    creator_id: creator1.id,
    brand_name: "Robinhood",
    brand_contact_email: "influencers@robinhood.com",
    fit_score: 78,
    estimated_value_cents: 180000,
    stage: "negotiating",
    notes: "Discussing terms for a 3-video series.",
  });
  await createDeal({
    creator_id: creator1.id,
    brand_name: "Mint Mobile",
    fit_score: 65,
    estimated_value_cents: 120000,
    stage: "active",
    actual_value_cents: 110000,
    notes: "Contract signed, first deliverable due in 2 weeks.",
  });
  await createDeal({
    creator_id: creator1.id,
    brand_name: "Acorns",
    fit_score: 88,
    estimated_value_cents: 200000,
    stage: "completed",
    actual_value_cents: 200000,
    notes: "Successfully completed campaign.",
  });
  console.log("  Created 5 deals for creator 1");

  // Creator 1 transactions
  await logTransaction({
    creator_id: creator1.id,
    type: "agent_spend",
    amount_cents: 50,
    description: "Brand research: NordVPN",
    service: "stableenrich",
  });
  await logTransaction({
    creator_id: creator1.id,
    type: "agent_spend",
    amount_cents: 75,
    description: "Pitch generation: Wealthfront",
    service: "anthropic",
  });
  await logTransaction({
    creator_id: creator1.id,
    type: "agent_spend",
    amount_cents: 25,
    description: "Social analytics pull",
    service: "stablesocial",
  });
  await logTransaction({
    creator_id: creator1.id,
    type: "income",
    amount_cents: 200000,
    description: "Acorns campaign payment",
    service: "brand_deal",
  });
  console.log("  Created 4 transactions for creator 1");

  // Creator 1 platform connections
  await upsertConnection({
    creator_id: creator1.id,
    platform: "youtube",
    access_token: "demo-yt-token",
    platform_username: "AdaFinance",
    metadata: { subscribers: 125000 },
  });
  await upsertConnection({
    creator_id: creator1.id,
    platform: "instagram",
    access_token: "demo-ig-token",
    platform_username: "ada.finance",
    metadata: { followers: 45000 },
  });
  console.log("  Created 2 platform connections for creator 1");

  // Creator 1 conversation history
  await saveMessage({
    creator_id: creator1.id,
    role: "user",
    content: "scan for deals",
    metadata: { platform: "telegram" },
  });
  await saveMessage({
    creator_id: creator1.id,
    role: "assistant",
    content:
      "I found 3 brand opportunities that match your finance niche. NordVPN (85% fit, ~$2,500), Wealthfront (92% fit, ~$3,500), and Robinhood (78% fit, ~$1,800). Want me to draft pitches?",
    metadata: {},
  });
  console.log("  Created 2 messages for creator 1");

  // --- Creator 2: WhatsApp-based fitness creator ---
  const creator2 = await createCreator({
    display_name: "Bola Fit",
    whatsapp_phone: "2348001234567",
    niche: "fitness",
    wallet_id: "test-wallet-bola",
    wallet_address: "0xB01a000000000000000000000000000000000002",
    free_credits_remaining_cents: 1000,
    monthly_spend_cents: 0,
    settings: {},
  });
  console.log(`\nCreated creator 2: ${creator2.id} (${creator2.display_name})`);

  await createDeal({
    creator_id: creator2.id,
    brand_name: "Gymshark",
    fit_score: 95,
    estimated_value_cents: 500000,
    stage: "discovered",
    notes: "Perfect fit for fitness content creator.",
  });
  await createDeal({
    creator_id: creator2.id,
    brand_name: "MyProtein",
    fit_score: 88,
    estimated_value_cents: 200000,
    stage: "responded",
    response_text: "We're interested! Let's discuss terms.",
    notes: "Supplement brand, good audience overlap.",
  });
  console.log("  Created 2 deals for creator 2");

  await upsertConnection({
    creator_id: creator2.id,
    platform: "tiktok",
    access_token: "demo-tt-token",
    platform_username: "bolafit",
    metadata: { followers: 320000 },
  });
  console.log("  Created 1 platform connection for creator 2");

  console.log("\n✅ Seed complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
