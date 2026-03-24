# Indyfren — System Architecture

> v0.2 — March 2026
> An autonomous AI agent that acts as a creator's business manager, powered by OpenClaw agent framework, Privy embedded wallets on Tempo Network, and x402 micropayments.

---

## 0. Finalized Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent framework | **OpenClaw** | Open-source, customizable, self-hostable. Full control over agent behavior. |
| Wallet | **Privy** | Best DX, social login, embedded wallets for both agent and creator. |
| Chain | **Tempo Network** | Purpose-built for x402 payments. Native alignment with agent payment use case. |
| Pricing | **Hybrid** | $29-79/mo subscription + 3% revenue share on agent-attributed deals. |
| First niche | **Content Creators** | YouTubers, TikTokers, podcasters. Largest TAM, most APIs, highest brand deal volume. |
| Primary interface | **Telegram + WhatsApp** | Both simultaneously with shared bot logic. Meet creators where they already are. |
| x402 cost model | **$10 free credits → creator-funded** | Early users get $10 free. After that, creators fund agent wallet. Full transparency. |
| Browser automation | **BrowserBase** | Managed headless browser. Agent can browse deal platforms, scrape, fill forms from day one. |
| Timeline | **8 weeks to MVP** | Telegram/WhatsApp bot + Money Agent + Privy wallet + brand deal scanning + web dashboard. |
| Team | **Solo founder + AI agents** | Ruthless prioritization. AI-assisted development throughout. |

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CREATOR (Human)                       │
│  Mobile App / Web Dashboard / SMS / Telegram / WhatsApp  │
└──────────────────────┬──────────────────────────────────┘
                       │ Approvals, preferences, chat
                       ▼
┌─────────────────────────────────────────────────────────┐
│              INDYFREN ORCHESTRATOR                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │            Agent Runtime Layer                     │  │
│  │  OpenClaw Agent Framework                          │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐             │  │
│  │  │ Money   │ │ Content │ │ Ops     │             │  │
│  │  │ Agent   │ │ Agent   │ │ Agent   │             │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘             │  │
│  │       └───────────┼───────────┘                   │  │
│  │                   ▼                               │  │
│  │         Shared Agent Memory (RAG)                 │  │
│  │         Creator Profile + Context                 │  │
│  └───────────────────┬───────────────────────────────┘  │
│                      │                                   │
│  ┌───────────────────┼───────────────────────────────┐  │
│  │            Action Execution Layer                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │ Web      │ │ Email    │ │ Platform APIs    │  │  │
│  │  │ Browser  │ │ Client   │ │ (YouTube, IG...) │  │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │  │
│  └───────────────────┬───────────────────────────────┘  │
│                      │                                   │
│  ┌───────────────────┼───────────────────────────────┐  │
│  │            Wallet & Payments Layer                 │  │
│  │  ┌──────────────┐  ┌─────────────────────────┐   │  │
│  │  │ Privy        │  │ x402 Payment Client     │   │  │
│  │  │ Embedded     │  │ (Tempo Network)         │   │  │
│  │  │ Wallet       │  │                         │   │  │
│  │  │ (USDC on     │  │ Auto-pay for services   │   │  │
│  │  │  Tempo)      │  │ the agent uses          │   │  │
│  │  └──────────────┘  └─────────────────────────┘   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Core System Components

### 2.1 Agent Runtime Layer

The brain. Each creator gets a persistent agent instance that maintains context about their business.

**Framework: OpenClaw**

Open-source, customizable, self-hostable agent framework. Full control over agent behavior, tool registration, and execution flow. Can plug in any LLM backend (Claude API for reasoning, open-source models for routine tasks).

**LLM Strategy within OpenClaw:**
- **Claude Sonnet** — complex reasoning tasks (pitching, contract analysis, pricing strategy)
- **Claude Haiku** — routine tasks (scanning, categorizing, drafting)
- **Open-source fallback** — simple classification, intent detection, templated responses

**Agent Architecture — Multi-Agent with Shared Memory:**

```
Creator Agent Instance
├── Money Agent (P0)
│   ├── Brand Deal Scanner (cron: every 6h)
│   ├── Rate Calculator (on-demand)
│   ├── Pitch Generator (on-demand, hybrid)
│   ├── Contract Analyzer (on-demand, hybrid)
│   └── Revenue Diversification Advisor (weekly)
│
├── Content Agent (P1)
│   ├── Repurposing Engine (event-driven: new content)
│   ├── Strategy Planner (weekly)
│   ├── Analytics Aggregator (daily cron)
│   └── SEO Optimizer (on-demand)
│
├── Ops Agent (P1-P2)
│   ├── Financial Tracker (daily cron)
│   ├── Invoice Manager (event-driven)
│   ├── Calendar Manager (continuous)
│   └── Inbox Triager (continuous)
│
└── Shared Memory Store
    ├── Creator Profile (niche, platforms, rates, goals)
    ├── Conversation History (summarized)
    ├── Deal Pipeline (active deals, history)
    ├── Content Library (past content, performance)
    ├── Contact Graph (brands, collaborators, fans)
    └── Financial State (income, expenses, forecasts)
```

**Key Design Decisions:**
- Each sub-agent is a **skill** with its own system prompt, tools, and context
- Agents share memory via a **vector store + structured DB** (not by passing everything in context)
- The orchestrator decides which agent handles each task based on intent classification
- **Autonomy levels** are enforced at the orchestrator: autonomous tasks execute → hybrid tasks queue for approval

### 2.2 Action Execution Layer

The hands. How the agent actually does things in the real world.

**Web Browser (for research, scraping, form-filling):**
```
┌─────────────────────────────────┐
│        Browser Automation        │
│  Playwright / Puppeteer          │
│  ┌─────────────────────────┐    │
│  │ Headless Chrome pool     │    │
│  │ (sandboxed per creator)  │    │
│  └─────────────────────────┘    │
│                                  │
│  Capabilities:                   │
│  • Browse brand deal platforms   │
│  • Fill out applications         │
│  • Monitor competitor pages      │
│  • Submit to marketplaces        │
│  • Scrape pricing data           │
│  • Submit festival/distribution  │
│    applications                  │
└─────────────────────────────────┘
```

**Email Client (for outreach, follow-ups, invoicing):**
```
┌─────────────────────────────────┐
│        Email Engine              │
│  ┌─────────────────────────┐    │
│  │ Creator's connected      │    │
│  │ email (OAuth/IMAP)       │    │
│  │ OR                       │    │
│  │ Indyfren-managed alias   │    │
│  │ (manager@indyfren.xyz)   │    │
│  └─────────────────────────┘    │
│                                  │
│  Capabilities:                   │
│  • Send pitches as creator       │
│  • Follow up on conversations    │
│  • Send invoices                 │
│  • Categorize incoming mail      │
│  • Auto-respond to routine       │
└─────────────────────────────────┘
```

**Platform API Integrations:**
```
Platform Connectors (OAuth2)
├── YouTube Analytics API
├── Instagram Graph API
├── TikTok Business API
├── Twitter/X API v2
├── Spotify for Artists API
├── Patreon API
├── Stripe API (payments in/out)
├── Gumroad API
├── Amazon KDP Reports (scraping)
├── Google Analytics
├── Mailchimp / ConvertKit / Beehiiv
└── Calendar (Google Calendar / Cal.com)
```

**x402-Enabled Service Calls:**

The agent can pay for premium services on the creator's behalf using x402:

```
x402 Service Consumption
├── StableEnrich — Find brand contact info, LinkedIn data, company research
├── StableSocial — Pull social media analytics and competitor data
├── StableStudio — Generate thumbnails, carousel graphics, media kit visuals
├── StableEmail — Send outreach emails at scale
├── Firecrawl / Exa — Deep web research on brands, trends, competitors
├── Custom x402 APIs — Any future paid API the agent discovers
└── Agent-to-Agent — Pay other AI agents for specialized tasks
```

### 2.3 Wallet & Payments Layer

The wallet. Every Indyfren agent has its own embedded wallet for paying for services and receiving payments on behalf of the creator.

**Wallet Infrastructure:**

```
┌─────────────────────────────────────────┐
│          Wallet Architecture             │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │     Privy Embedded Wallet        │    │
│  │     (or Coinbase CDP / Turnkey)   │    │
│  │                                   │    │
│  │  • Server-side wallet for agent   │    │
│  │  • Client-side wallet for creator │    │
│  │  • Both on Base (L2) + Solana     │    │
│  │  • USDC as primary currency       │    │
│  └──────────┬──────────────────────┘    │
│             │                            │
│  ┌──────────▼──────────────────────┐    │
│  │     Spending Controls            │    │
│  │                                   │    │
│  │  • Per-transaction limit          │    │
│  │    ($5 default, configurable)     │    │
│  │  • Daily spend cap                │    │
│  │    ($50 default, configurable)    │    │
│  │  • Approval required above        │    │
│  │    threshold                      │    │
│  │  • Creator can pause agent        │    │
│  │    spending anytime               │    │
│  └──────────┬──────────────────────┘    │
│             │                            │
│  ┌──────────▼──────────────────────┐    │
│  │     x402 Payment Client          │    │
│  │                                   │    │
│  │  • Auto-negotiate x402 payments   │    │
│  │  • SIWX (Sign-In-With-X) auth     │    │
│  │  • Micropayments per API call     │    │
│  │  • Transaction logging for        │    │
│  │    creator transparency           │    │
│  └──────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Why Privy:**
- Embedded wallets = no seed phrase management for creators
- Server-side wallets = agent can transact autonomously within spending limits
- Social login recovery = creators don't lose funds if they lose a device
- Tempo Network = purpose-built for x402 micropayments

**Payment Flows:**

```
AGENT PAYING FOR SERVICES (outbound):
Creator funds agent wallet (USDC) → Agent discovers service needed →
x402 negotiation → micropayment → service consumed → result applied

CREATOR RECEIVING PAYMENTS (inbound):
Brand sends payment → Creator's Indyfren wallet (or connected Stripe) →
Agent tracks, reconciles, and reports

CROSS-BORDER (the killer feature):
Nigerian creator × U.S. brand → Brand pays USDC to creator wallet on Tempo →
Creator offramps to local currency via local exchange
(Saves 10-30% vs traditional wire/PayPal)
```

---

## 3. Data Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Data Layer                         │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │  PostgreSQL      │  │  Vector Store             │  │
│  │  (Supabase)      │  │  (Pinecone / pgvector)    │  │
│  │                  │  │                            │  │
│  │  • Users         │  │  • Creator content         │  │
│  │  • Deals         │  │    embeddings              │  │
│  │  • Invoices      │  │  • Brand research          │  │
│  │  • Transactions  │  │  • Conversation memory     │  │
│  │  • Platform      │  │  • Industry knowledge      │  │
│  │    connections   │  │  • Contract patterns        │  │
│  │  • Agent configs │  │                            │  │
│  │  • Wallet state  │  │                            │  │
│  └─────────────────┘  └──────────────────────────┘  │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │  Redis           │  │  Object Storage           │  │
│  │                  │  │  (S3 / R2)                │  │
│  │  • Job queues    │  │                            │  │
│  │  • Rate limiting │  │  • Generated content       │  │
│  │  • Session state │  │  • Media kits              │  │
│  │  • Cron locks    │  │  • Invoices (PDF)          │  │
│  └─────────────────┘  │  • Contract scans          │  │
│                        └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 4. Agent Execution Model

### 4.1 Task Loop

```
┌──────────────────────────────────────────────────┐
│              Agent Task Loop                      │
│                                                   │
│  CRON TASKS (background, no approval needed):     │
│  ├── 6:00 AM — Morning scan                      │
│  │   ├── Scan brand deal platforms               │
│  │   ├── Pull overnight analytics                │
│  │   ├── Check pending invoices                  │
│  │   └── Monitor niche trends                    │
│  ├── 7:00 AM — Generate morning brief            │
│  ├── 6:00 PM — End-of-day summary               │
│  └── Weekly — Revenue health check, strategy     │
│                                                   │
│  EVENT-DRIVEN TASKS:                              │
│  ├── New content published → Repurposing engine  │
│  ├── Brand responds → Negotiation support        │
│  ├── Content goes viral → Crisis capitalization  │
│  ├── Payment received → Update financials        │
│  ├── Invoice overdue → Send reminder             │
│  └── Creator message → Intent → Route to agent   │
│                                                   │
│  APPROVAL QUEUE (hybrid tasks):                   │
│  ├── Pitch ready → Creator reviews → Send/Edit   │
│  ├── Contract flagged → Creator reviews → Accept │
│  ├── Price recommended → Creator confirms        │
│  ├── Content generated → Creator approves        │
│  └── Crisis action → Creator authorizes          │
└──────────────────────────────────────────────────┘
```

### 4.2 Tool Registry

Every tool the agent can use is registered with permissions:

```typescript
interface AgentTool {
  name: string;
  description: string;
  autonomyLevel: "autonomous" | "hybrid";
  costCategory: "free" | "x402" | "platform-api";
  maxCostPerUse: number; // in USD, for x402 tools
  requiresApproval: boolean;
  execute: (params: any) => Promise<ToolResult>;
}

// Example tool registry
const tools: AgentTool[] = [
  {
    name: "search_brand_deals",
    description: "Search brand deal platforms for opportunities",
    autonomyLevel: "autonomous",
    costCategory: "x402",
    maxCostPerUse: 0.50,
    requiresApproval: false,
    execute: async (params) => {
      // Uses StableEnrich x402 API to find brand contacts
      // Uses web browser to scan creator marketplaces
    }
  },
  {
    name: "send_pitch_email",
    description: "Send a brand deal pitch email",
    autonomyLevel: "hybrid",
    costCategory: "x402",
    maxCostPerUse: 0.10,
    requiresApproval: true, // Always needs creator approval
    execute: async (params) => {
      // Uses StableEmail x402 API or creator's connected email
    }
  },
  {
    name: "generate_media_kit",
    description: "Generate visual media kit for brand pitches",
    autonomyLevel: "autonomous",
    costCategory: "x402",
    maxCostPerUse: 1.00,
    requiresApproval: false,
    execute: async (params) => {
      // Uses StableStudio x402 API for image generation
    }
  },
  // ... 30+ tools total
];
```

---

## 5. Product Packaging & Business Model

### 5.1 How Creators Pay for Indyfren

```
┌─────────────────────────────────────────────────────┐
│           INDYFREN PRICING MODEL                     │
│                                                      │
│  Option A: SaaS Subscription (Recommended Start)     │
│  ─────────────────────────────────────────────       │
│  Free Tier:     $0/mo — Dashboard only, no agent     │
│                  Connect platforms, see analytics     │
│                  Bait: show them what they're missing │
│                                                      │
│  Starter:       $29/mo — Money Agent only (P0)       │
│                  Brand deal scanning                  │
│                  Rate intelligence                    │
│                  Basic pitch generation               │
│                  5 agent actions/day                  │
│                                                      │
│  Pro:           $79/mo — Full agent suite             │
│                  All P0 + P1 skills                   │
│                  Unlimited agent actions              │
│                  Content repurposing                  │
│                  Financial tracking                   │
│                  Priority support                     │
│                                                      │
│  Business:      $199/mo — Enterprise features         │
│                  All skills including P2              │
│                  Multi-platform distribution          │
│                  AI content protection                │
│                  Custom agent training                │
│                  White-glove onboarding               │
│                                                      │
│  ─────────────────────────────────────────────       │
│                                                      │
│  Option B: Revenue Share (Future, High-Trust)         │
│  ─────────────────────────────────────────────       │
│  $0/mo + 5% of revenue the agent directly             │
│  generates (brand deals it found, products it         │
│  helped launch). Tracked on-chain for transparency.   │
│                                                      │
│  Why this works: Aligns incentives. Agent only         │
│  makes money when creator makes money. Replaces        │
│  management's 15-20% with 5% + better service.        │
│                                                      │
│  Option C: Hybrid (Recommended v1)                    │
│  ─────────────────────────────────────────────       │
│  $29-79/mo base + 3% revenue share on                 │
│  agent-attributed deals above $500/mo.                │
│  Smart contract tracks attribution automatically.     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 5.2 How Indyfren Pays for Itself (Unit Economics)

```
COST PER CREATOR PER MONTH (estimated):
├── LLM API costs (Claude)
│   ├── Haiku for routine tasks: ~$2-5/mo
│   ├── Sonnet for complex tasks: ~$3-8/mo
│   └── Opus for high-stakes (contracts, pitches): ~$1-3/mo
│   Total LLM: ~$6-16/mo
│
├── x402 service costs (passed through or absorbed)
│   ├── Brand research (StableEnrich): ~$2-5/mo
│   ├── Email sending (StableEmail): ~$1-3/mo
│   ├── Image generation (StableStudio): ~$1-2/mo
│   └── Web scraping: ~$1-2/mo
│   Total x402: ~$5-12/mo
│
├── Infrastructure
│   ├── Compute (agent runtime): ~$2-4/mo
│   ├── Database (Supabase): ~$1-2/mo
│   ├── Storage: ~$0.50/mo
│   └── Browser pool: ~$1-3/mo
│   Total infra: ~$4.50-9.50/mo
│
└── TOTAL COST PER CREATOR: ~$15-37/mo
    At $79/mo Pro pricing: 53-81% gross margin ✓
    At $29/mo Starter: thin but viable at scale
```

### 5.3 Distribution Strategy

```
HOW CREATORS FIND INDYFREN:
├── 1. Creator-to-creator referral (primary)
│      "This AI thing found me a $3K brand deal"
│      Referral: 1 month free for both parties
│
├── 2. Content marketing (meta: use the agent to market itself)
│      Agent generates content about creator economy
│      Builds audience of creators organically
│
├── 3. Platform integrations
│      YouTube extension, TikTok companion app
│      "See what you're leaving on the table"
│
├── 4. Niche community infiltration
│      Music producer Discord servers
│      Author subreddits
│      Filmmaker Twitter circles
│
└── 5. x402 marketplace
       List Indyfren as a service other agents can recommend
       Agent-to-agent referrals (emerging channel)
```

---

## 6. Technical Stack (Recommended)

```
CREATOR INTERFACE:
├── Telegram Bot (grammY framework — rich inline buttons, media)
├── WhatsApp Bot (WhatsApp Business API via Meta Cloud API)
├── Shared bot logic layer (platform-agnostic message handling)
├── Next.js 15 web dashboard (companion, not primary)
└── Tailwind CSS + Framer Motion (dashboard UI)

BACKEND:
├── Node.js / TypeScript (API server)
├── Hono (lightweight, edge-compatible API)
├── BullMQ (job queues for cron tasks)
└── WebSocket (real-time agent ↔ bot communication)

AI / AGENT:
├── OpenClaw (agent framework — orchestration, tool use, memory)
├── Claude API (Sonnet for reasoning, Haiku for routine)
├── pgvector (long-term memory / RAG)
├── BrowserBase (managed headless browser for web actions)
└── Custom tool registry (x402-aware, permission-gated)

BLOCKCHAIN / PAYMENTS:
├── Privy (embedded wallets, social login)
├── x402 Protocol (micropayments for services)
├── Tempo Network (primary chain for x402 payments)
├── USDC (stablecoin for all transactions)
├── Viem (blockchain interactions)
└── Smart contracts (revenue share tracking on Tempo)

DATABASE:
├── Supabase (PostgreSQL + Auth + Realtime + Row-Level Security)
├── Redis / Upstash (queues, caching, rate limiting, cron locks)
└── Cloudflare R2 (object storage — media kits, invoices)

INFRA:
├── Railway (agent runtime — long-running OpenClaw processes)
├── Vercel (web dashboard + API routes)
├── Cloudflare Workers (webhook handlers for Telegram/WhatsApp)
└── Resend (transactional email fallback)
```

---

## 7. Security & Trust Model

```
CRITICAL: The agent has access to the creator's:
  - Social media accounts (OAuth)
  - Email (read/send)
  - Financial data
  - Business relationships
  - Wallet (with spending limits)

TRUST ARCHITECTURE:
├── Spending Limits
│   ├── Per-transaction cap (default $5)
│   ├── Daily cap (default $50)
│   ├── Monthly cap (default $500)
│   └── Creator adjusts via dashboard
│
├── Action Permissions
│   ├── Autonomous: monitor, scan, analyze, draft
│   ├── Hybrid: send emails, accept deals, publish content
│   ├── Forbidden: change passwords, delete accounts, large payments
│   └── Creator configures per-action approval requirements
│
├── Audit Trail
│   ├── Every agent action logged with timestamp
│   ├── Every transaction recorded (on-chain for payments)
│   ├── Creator can review full action history
│   └── "Why did you do this?" — agent explains reasoning
│
├── Data Isolation
│   ├── Each creator's data fully isolated (row-level security)
│   ├── Agent cannot access other creators' data
│   ├── Platform tokens encrypted at rest (AES-256)
│   └── Wallet keys managed by Privy (HSM-backed)
│
└── Kill Switch
    ├── Creator can pause agent instantly
    ├── Revoke all OAuth tokens in one click
    ├── Freeze wallet spending
    └── Export all data (GDPR-compliant)
```

---

## 8. MVP Scope (8 Weeks — Solo Founder)

```
WEEK 1-2: Foundation
═══════════════════════════════════════════
├── Set up OpenClaw agent framework
├── Privy integration (embedded wallet on Tempo)
├── Supabase schema (users, deals, transactions)
├── Telegram bot skeleton (grammY)
├── WhatsApp bot skeleton (Meta Cloud API)
└── Shared bot message handler

WEEK 3-4: Money Agent (Core Loop)
═══════════════════════════════════════════
├── Brand deal scanner
│   ├── BrowserBase scraping of deal platforms
│   ├── x402 → StableEnrich for brand contact enrichment
│   └── Opportunity scoring (Claude Haiku)
├── Rate calculator (benchmark engine)
├── Pitch generator (Claude Sonnet, creator approves in chat)
└── Deal pipeline tracker (Supabase)

WEEK 5-6: Agent Loop + Wallet
═══════════════════════════════════════════
├── Morning brief (daily message in Telegram/WhatsApp)
├── Inline approval buttons (approve/skip/edit)
├── Agent executes approved actions
├── $10 free credits provisioned on signup
├── x402 payment flow (agent pays for services)
├── Transaction log (creator can check spend in chat)
└── Connect YouTube or Instagram (OAuth)

WEEK 7-8: Polish + Web Dashboard
═══════════════════════════════════════════
├── Companion web dashboard (Next.js)
│   ├── Deal pipeline view
│   ├── Revenue tracker (basic)
│   ├── Wallet balance + transaction history
│   └── Platform connections
├── Onboarding flow (first scan → "holy shit" moment)
├── Error handling, edge cases, rate limiting
└── Landing page + waitlist → launch

WHAT TO SKIP IN MVP:
├── Content repurposing (P1 — Month 3)
├── Financial tracking beyond basics (P1 — Month 3)
├── Revenue share smart contract (post-MVP)
├── Multi-agent coordination (single Money Agent first)
├── On-chain content provenance (Phase 3)
└── AI content protection (Phase 3)
```

---

## 9. Architecture Diagram — Data Flow

```
Creator signs up
    │
    ▼
Privy creates embedded wallet (Base L2, USDC)
    │
    ▼
Creator connects YouTube (OAuth2)
    │
    ▼
Agent pulls analytics via YouTube API
    │
    ▼
Agent stores creator profile in Supabase + embeddings in pgvector
    │
    ▼
Morning cron triggers:
    ├── Agent browses brand deal platforms (Playwright)
    ├── Agent enriches brand contacts (x402 → StableEnrich)
    ├── Agent scores opportunities (Claude reasoning)
    │
    ▼
Agent generates morning brief
    │
    ▼
Push notification → Creator opens app
    │
    ▼
Creator approves: "Pitch Brand X"
    │
    ▼
Agent generates pitch (Claude) + sends email (x402 → StableEmail)
    │
    ▼
Brand responds → Agent drafts counter → Creator approves
    │
    ▼
Deal closed → Agent generates invoice → Tracks payment
    │
    ▼
Payment received (USDC or fiat) → Agent updates dashboard
    │
    ▼
Agent recommends: "Based on this deal, here are 3 more brands to pitch"
    └── Loop continues
```

---

## 10. Remaining Open Questions

| # | Question | Context |
|---|----------|---------|
| 1 | OpenClaw version & maturity | Need to evaluate current OpenClaw capabilities — does it support the tool registry pattern we need? Fallback: custom orchestrator on top of Claude API. |
| 2 | Privy + Tempo compatibility | Verify Privy supports Tempo Network wallets natively, or if we need a custom integration. |
| 3 | WhatsApp Business API approval | Meta requires business verification for WhatsApp API. Start this process in Week 1 — can take 2-4 weeks. |
| 4 | BrowserBase pricing at scale | Current pricing works for MVP. Model costs at 1K, 10K, 100K creators to decide when to self-host. |
| 5 | Revenue share smart contract | Design post-MVP. Needs: attribution tracking (which deals did the agent find?), on-chain settlement, dispute resolution. |
| 6 | Creator data privacy (GDPR) | Agent accesses social media, email, financial data. Need privacy policy, data processing agreement, and creator consent flows. |
| 7 | Rate limiting strategy | How many agent actions per creator per day? Free tier vs paid tier limits. |
| 8 | Agent personality/voice | Should the agent have a distinct personality? Or mirror the creator's communication style? |
