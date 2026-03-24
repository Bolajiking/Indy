import { useState } from "react";

const skillCategories = [
  {
    id: "money",
    title: "Money Engine",
    subtitle: "The agent's #1 job: help creators make more money",
    priority: "P0",
    color: "#22c55e",
    icon: "💰",
    rationale: "Creators under management earn 3x more. 58.3% face monetization difficulties. This is the wedge that justifies the product's existence.",
    skills: [
      {
        name: "Brand Deal Discovery",
        autonomy: "autonomous",
        description: "Continuously scan brand deal marketplaces, creator platforms, and social signals to find partnership opportunities that match the creator's niche, audience size, and content style.",
        tasks: [
          "Monitor brand deal platforms (AspireIQ, Grin, CreatorIQ, Upfluence) for matching opportunities",
          "Track brands that have previously worked with similar creators in the same niche",
          "Analyze brand social accounts to identify companies actively seeking creator partnerships",
          "Score and rank opportunities by fit, potential payout, and brand reputation",
          "Flag time-sensitive opportunities with deadlines",
          "Build a running pipeline of potential brand partners with status tracking",
        ],
        why: "54-60% of creators say discovery is their biggest pain. The agent flips this from outbound hustle to inbound matching."
      },
      {
        name: "Rate Intelligence & Pricing",
        autonomy: "autonomous",
        description: "Benchmark the creator's rates against market data and dynamically recommend what to charge based on niche, platform, engagement rate, and audience demographics.",
        tasks: [
          "Calculate recommended rates per platform (Instagram post, YouTube integration, TikTok, newsletter mention, etc.)",
          "Benchmark against creators with similar audience size and engagement in the same niche",
          "Track rate trends over time — alert when the creator is undercharging relative to growth",
          "Generate rate cards formatted for different brand tiers (startup, mid-market, enterprise)",
          "Factor in usage rights, exclusivity periods, and content repurposing into pricing",
          "Provide negotiation talking points when a brand lowballs",
        ],
        why: "Most creators have no idea what to charge. Male creators earn 40% more per collab — partly because of better negotiation. The agent levels this playing field."
      },
      {
        name: "Proposal & Pitch Generation",
        autonomy: "hybrid",
        description: "Auto-draft professional brand deal proposals, sponsorship decks, and outreach emails tailored to each opportunity.",
        tasks: [
          "Generate personalized pitch emails for outbound brand outreach",
          "Create media kits with auto-pulled analytics, audience demographics, and past work",
          "Draft sponsorship proposals with deliverables, timelines, and pricing tiers",
          "Customize pitch angles based on the brand's recent campaigns and messaging",
          "Generate case studies from past successful brand partnerships",
          "A/B test pitch variations and track response rates",
        ],
        why: "Creators who pitch professionally close 2-3x more deals. But most don't know how to write a pitch deck. The agent becomes their business development arm."
      },
      {
        name: "Contract & Deal Review",
        autonomy: "hybrid",
        description: "Analyze brand deal contracts and flag problematic terms — usage rights, exclusivity, payment terms, content ownership, and cancellation clauses.",
        tasks: [
          "Parse contract language and highlight key terms in plain English",
          "Flag unfavorable clauses (perpetual usage rights, long exclusivity, no kill fee)",
          "Compare deal terms against industry standards",
          "Suggest counter-terms for negotiation",
          "Track contract deadlines (deliverable dates, payment milestones, exclusivity expiration)",
          "Maintain a library of contract templates for common deal types",
        ],
        why: "Creators routinely sign away perpetual usage rights or accept bad payment terms because they don't understand contracts. This is where management earns its 20% — and where the agent replaces them."
      },
      {
        name: "Revenue Stream Diversification",
        autonomy: "hybrid",
        description: "Analyze the creator's current income mix and proactively recommend new revenue streams they should pursue based on their audience, content type, and growth stage.",
        tasks: [
          "Audit current revenue streams and calculate dependency risk (e.g., '78% of income from one platform')",
          "Recommend new revenue streams based on audience signals and creator strengths",
          "Model projected revenue from each new stream (subscriptions, digital products, affiliates, etc.)",
          "Create step-by-step activation plans for each new stream",
          "Set milestones and track progress toward diversification goals",
          "Benchmark revenue mix against top performers in the same niche",
        ],
        why: "Top earners run 3.3 streams. Low earners run 2.2. The gap isn't talent — it's strategic awareness. The agent closes this gap."
      },
      {
        name: "Affiliate Strategy Optimization",
        autonomy: "autonomous",
        description: "Find, manage, and optimize affiliate partnerships — matching products to audience, tracking performance, and maximizing commission rates.",
        tasks: [
          "Scan affiliate networks (Amazon, Impact, ShareASale, individual brand programs) for high-fit products",
          "Match affiliate products to the creator's content themes and audience purchase behavior",
          "Generate contextual affiliate recommendations for upcoming content",
          "Track affiliate link performance across platforms and content pieces",
          "Identify underperforming affiliates and suggest replacements",
          "Negotiate upgraded commission rates based on performance data",
        ],
        why: "Affiliate marketing is hitting $36.9B by 2030. Low earners over-index on affiliates but do it badly. Done right, it's passive income. Done wrong, it's pennies."
      },
    ],
  },
  {
    id: "financial",
    title: "Financial Operations",
    subtitle: "Turn chaotic creator income into a real business",
    priority: "P1",
    color: "#818cf8",
    icon: "📊",
    rationale: "Income instability is the #4 pain point. Creators don't have CFOs. Most don't even track their income properly. The agent becomes their financial co-pilot.",
    skills: [
      {
        name: "Income Aggregation & Dashboard",
        autonomy: "autonomous",
        description: "Pull revenue data from all platforms and income sources into a single real-time view.",
        tasks: [
          "Connect to platform APIs (YouTube, TikTok, Instagram, Patreon, Gumroad, Stripe, etc.)",
          "Aggregate ad revenue, brand deal payments, subscription income, product sales, and tips",
          "Display income by stream, by platform, by month — with trend lines",
          "Calculate effective hourly rate per content type",
          "Track year-over-year growth and monthly runway",
          "Generate monthly/quarterly income reports",
        ],
        why: "Most creators have no idea how much they actually make until tax time. Visibility = better decisions."
      },
      {
        name: "Cash Flow Forecasting",
        autonomy: "autonomous",
        description: "Predict future income based on historical patterns, confirmed deals, and seasonal trends.",
        tasks: [
          "Forecast next 30/60/90 day revenue based on pipeline and historical patterns",
          "Flag upcoming cash crunches before they happen",
          "Account for seasonality (Q4 brand deal surge, January slowdown)",
          "Track pending payments and expected settlement dates",
          "Model 'what if' scenarios (what if brand deals drop 30%? what if subscriptions grow 20%?)",
          "Set and track savings goals against projected income",
        ],
        why: "Creator income is spiky. A $5K month followed by a $200 month is normal. The agent smooths the chaos."
      },
      {
        name: "Invoicing & Payment Collection",
        autonomy: "autonomous",
        description: "Auto-generate invoices, track payment status, and follow up on late payments.",
        tasks: [
          "Auto-generate branded invoices from confirmed deal terms",
          "Track invoice status (sent, viewed, paid, overdue)",
          "Send automated payment reminders at configurable intervals",
          "Calculate and apply late fees per contract terms",
          "Support multiple currencies and cross-border payment methods",
          "Generate end-of-year payment summaries for tax purposes",
        ],
        why: "Chasing payments is soul-crushing and most creators are bad at it. Automate the awkward conversations."
      },
      {
        name: "Tax Estimation & Expense Tracking",
        autonomy: "hybrid",
        description: "Estimate quarterly tax obligations, track deductible expenses, and prepare for tax season.",
        tasks: [
          "Calculate estimated quarterly tax payments based on actual earnings",
          "Categorize expenses (equipment, software, travel, home office) for deduction",
          "Flag potential deductions the creator might be missing",
          "Track business vs personal spending ratios",
          "Generate tax-ready income and expense summaries",
          "Alert when quarterly estimated payments are due",
        ],
        why: "Freelance/creator taxes are complicated and expensive to mess up. An always-on tax assistant saves thousands."
      },
    ],
  },
  {
    id: "content",
    title: "Content Operations",
    subtitle: "Do more with less — the creator's time is sacred",
    priority: "P1",
    color: "#f59e0b",
    icon: "🎬",
    rationale: "48% of creators are solo operators. They spend more time on ops than creating. The agent gives them back their time so they can focus on what actually generates revenue: making great content.",
    skills: [
      {
        name: "Content Repurposing Engine",
        autonomy: "autonomous",
        description: "Take one piece of content and automatically generate adapted versions for every relevant platform.",
        tasks: [
          "Convert long-form video → short clips (identify key moments, hooks, highlights)",
          "Transform podcast episodes → Twitter/X threads, LinkedIn posts, blog summaries",
          "Turn blog posts → carousel graphics, email newsletter content, video scripts",
          "Adapt aspect ratios and formats per platform (9:16, 1:1, 16:9)",
          "Generate platform-specific captions and hashtag sets",
          "Queue repurposed content with optimal spacing to avoid audience fatigue",
        ],
        why: "Full-time creators use 3.4 platforms. Manually adapting content for each one eats 10-15 hours/week. The agent turns 1 piece into 7."
      },
      {
        name: "Content Strategy & Calendar",
        autonomy: "hybrid",
        description: "Plan, schedule, and optimize a content calendar based on audience data, trending topics, and revenue goals.",
        tasks: [
          "Generate weekly/monthly content calendars aligned to revenue goals",
          "Identify trending topics in the creator's niche before they peak",
          "Suggest content themes based on audience engagement patterns",
          "Balance content types (educational, entertaining, promotional, personal)",
          "Schedule posts at optimal times per platform based on historical engagement",
          "Track content-to-revenue attribution (which posts drive which income)",
        ],
        why: "Consistency is the #1 predictor of creator growth. But planning content while creating it is exhausting. The agent handles the strategy layer."
      },
      {
        name: "Performance Analytics & Insights",
        autonomy: "autonomous",
        description: "Aggregate analytics across all platforms into actionable insights — not just numbers, but recommendations.",
        tasks: [
          "Pull engagement data from all connected platforms into unified dashboard",
          "Identify top-performing content patterns (format, length, topic, posting time)",
          "Track audience growth rate, engagement rate, and retention metrics",
          "Benchmark performance against similar creators in the niche",
          "Generate weekly insight digests ('your Reels outperformed videos 3:1 this week — here's why')",
          "Flag anomalies (sudden engagement drops, viral moments, algorithm shifts)",
        ],
        why: "84% of creators use AI tools. But most use them for creation, not intelligence. The agent becomes the analytics team."
      },
      {
        name: "SEO & Discoverability Optimization",
        autonomy: "autonomous",
        description: "Optimize every piece of content for maximum discoverability — titles, descriptions, tags, thumbnails, and metadata.",
        tasks: [
          "Generate SEO-optimized titles, descriptions, and tags for YouTube videos",
          "Research and suggest keywords based on search volume and competition",
          "Optimize blog/newsletter content for search engines and AI answer engines",
          "Analyze thumbnail effectiveness and suggest improvements",
          "Track search ranking positions for target keywords",
          "Adapt content for Answer Engine Optimization (ChatGPT, Perplexity, Google AI)",
        ],
        why: "Discovery is the #1 creator challenge. SEO is the one channel that compounds over time and isn't algorithm-dependent."
      },
    ],
  },
  {
    id: "audience",
    title: "Audience & Community",
    subtitle: "Own the relationship — don't rent it from platforms",
    priority: "P1",
    color: "#ec4899",
    icon: "👥",
    rationale: "Platform dependency is an existential risk. The creators who build owned audiences (email, communities) are the ones who survive algorithm changes. 56% of creator communities launched in just the last 2 years — this is exploding.",
    skills: [
      {
        name: "Audience Intelligence",
        autonomy: "autonomous",
        description: "Build a deep profile of the creator's audience — who they are, what they want, where they come from, and what they'll pay for.",
        tasks: [
          "Aggregate demographic data across platforms (age, location, interests, active times)",
          "Identify audience segments and their distinct behaviors",
          "Track which audience segments are most engaged and most valuable (highest conversion)",
          "Monitor DMs, comments, and messages for recurring questions, requests, and pain points",
          "Generate audience persona profiles for brand deal pitches",
          "Predict audience response to new content types or products before launching",
        ],
        why: "Knowing your audience deeply is the difference between a creator and a media business. Most creators guess. The agent knows."
      },
      {
        name: "Community Building & Management",
        autonomy: "hybrid",
        description: "Help creators establish and grow owned communities — email lists, membership platforms, Discord servers, or community apps.",
        tasks: [
          "Recommend the right community platform based on creator type and audience",
          "Set up email capture flows, landing pages, and lead magnets",
          "Draft welcome sequences and onboarding flows for new members",
          "Monitor community health metrics (active members, churn, engagement)",
          "Generate community content prompts and discussion starters",
          "Identify and surface top community members for ambassador/moderator roles",
        ],
        why: "Community-led businesses are the fastest-growing segment. But most creators don't know where to start. The agent is the community operations manager."
      },
      {
        name: "Email & Direct Communication",
        autonomy: "hybrid",
        description: "Manage the creator's direct communication channels — newsletters, email sequences, and audience messaging.",
        tasks: [
          "Draft newsletter editions based on recent content and audience interests",
          "Set up automated email sequences (welcome, re-engagement, product launch)",
          "A/B test subject lines and send times",
          "Segment email lists by engagement level and interest",
          "Track open rates, click rates, and conversion per email",
          "Generate personalized responses to common DM questions and inquiries",
        ],
        why: "Email is the most durable audience channel. It survives algorithm changes, platform bans, everything. But most creators treat it as an afterthought."
      },
      {
        name: "Collaboration & Networking",
        autonomy: "hybrid",
        description: "Identify and facilitate creator-to-creator collaborations that grow both audiences.",
        tasks: [
          "Find complementary creators with similar audience size but different reach",
          "Score collaboration potential based on audience overlap and content compatibility",
          "Draft collab proposals and manage outreach",
          "Suggest collab formats (guest appearances, joint content, cross-promotion)",
          "Track collab outcomes (audience growth, engagement impact, revenue generated)",
          "Maintain a network map of creator relationships and past collaborations",
        ],
        why: "Collabs are one of the fastest organic growth levers. But finding the right partner and managing the logistics is a pain."
      },
    ],
  },
  {
    id: "products",
    title: "Product & Commerce",
    subtitle: "Help creators build things people actually buy",
    priority: "P2",
    color: "#06b6d4",
    icon: "🛍️",
    rationale: "45% of full-time creators own a brand — and they earn 2x more. Digital products (courses, templates, memberships) are the highest-margin revenue stream. Social commerce is projected to hit $23.4B on TikTok alone in 2026.",
    skills: [
      {
        name: "Product Opportunity Identification",
        autonomy: "hybrid",
        description: "Analyze audience signals to identify what products or services a creator should build.",
        tasks: [
          "Mine comments, DMs, and community posts for recurring asks ('can you make a course on...', 'do you sell...')",
          "Analyze competitors' product offerings and pricing in the same niche",
          "Suggest product types based on creator strengths (courses, templates, coaching, merch, digital downloads)",
          "Model revenue potential for each product concept",
          "Validate product ideas by running lightweight audience polls or waitlists",
          "Prioritize product roadmap based on effort vs revenue potential",
        ],
        why: "Most creators know they should sell something but have no idea what. The agent turns audience demand signals into product specs."
      },
      {
        name: "Product Launch Assistance",
        autonomy: "hybrid",
        description: "Help creators plan and execute product launches — from pre-launch hype to post-launch optimization.",
        tasks: [
          "Generate launch timelines with pre-launch, launch, and post-launch phases",
          "Draft launch emails, social posts, and promotional content",
          "Set up waitlists, pre-order pages, and early access flows",
          "Create pricing strategies (launch pricing, bundles, tiers)",
          "Track launch metrics in real-time and suggest adjustments",
          "Generate post-launch retrospectives with lessons for next time",
        ],
        why: "A good launch can 10x a product's revenue. Most creators wing it. The agent runs the launch playbook."
      },
      {
        name: "Storefront & Commerce Management",
        autonomy: "autonomous",
        description: "Manage the creator's digital storefront — product listings, inventory, fulfillment tracking, and customer communication.",
        tasks: [
          "Optimize product listings (titles, descriptions, images, pricing)",
          "Track sales, refunds, and customer satisfaction per product",
          "Generate automated customer support responses for common product questions",
          "Monitor inventory and fulfillment status for physical products",
          "Suggest upsells, cross-sells, and bundle opportunities",
          "Manage TikTok Shop, Instagram Shopping, and other social commerce channels",
        ],
        why: "Social commerce is exploding. But managing storefronts across platforms is operationally complex. The agent handles the back office."
      },
    ],
  },
  {
    id: "admin",
    title: "Business Administration",
    subtitle: "The boring stuff that makes everything else work",
    priority: "P2",
    color: "#94a3b8",
    icon: "⚙️",
    rationale: "Solo creators spend 30-50% of their time on admin that doesn't generate revenue. Every hour saved on admin is an hour that can go toward creating or strategy.",
    skills: [
      {
        name: "Email & Inbox Management",
        autonomy: "hybrid",
        description: "Triage, draft, and manage the creator's business inbox — brand inquiries, fan messages, collaborations, and press.",
        tasks: [
          "Categorize incoming emails (brand deal, press inquiry, fan mail, spam, admin)",
          "Draft responses based on email type and creator's communication style",
          "Flag high-priority emails that need personal attention",
          "Auto-respond to common inquiries with templated but personalized replies",
          "Track email response times and follow-up reminders",
          "Maintain contact lists and CRM for business relationships",
        ],
        why: "Inbox management alone eats 5-10 hours per week for active creators. The agent handles the 80% that's routine."
      },
      {
        name: "Legal & IP Awareness",
        autonomy: "hybrid",
        description: "Help creators understand and protect their intellectual property, content rights, and business interests.",
        tasks: [
          "Monitor for unauthorized use of the creator's content across platforms",
          "Track content licensing agreements and expiration dates",
          "Generate basic terms of service and privacy policies for creator websites",
          "Flag when content usage agreements are about to expire or auto-renew",
          "Maintain a registry of all content, its licensing status, and usage rights granted",
          "Alert on regulatory changes affecting creators (FTC disclosure rules, platform policy changes)",
        ],
        why: "Creators are increasingly fighting for content ownership. The agent helps them understand what they own and protect it."
      },
      {
        name: "Scheduling & Calendar Management",
        autonomy: "autonomous",
        description: "Manage the creator's professional calendar — shoots, calls, deadlines, and deliverables.",
        tasks: [
          "Track brand deal deliverable deadlines and send advance reminders",
          "Schedule content shoots and production blocks",
          "Manage meeting requests and availability for brand calls",
          "Coordinate schedules for collaborations",
          "Block creative time and protect it from meeting creep",
          "Sync across personal and business calendars",
        ],
        why: "Creators who treat their time like a business outperform those who wing it. The agent enforces structure without being rigid."
      },
      {
        name: "Competitive & Industry Intelligence",
        autonomy: "autonomous",
        description: "Keep the creator informed about industry trends, competitor moves, and platform changes that affect their business.",
        tasks: [
          "Monitor competitor creators' content, growth, and monetization moves",
          "Track platform algorithm changes and policy updates",
          "Surface industry news and trends relevant to the creator's niche",
          "Alert on new monetization features launched by platforms",
          "Identify emerging platforms or features worth testing early",
          "Generate weekly industry briefings tailored to the creator's interests",
        ],
        why: "Creators who stay informed make better strategic decisions. But who has time to read industry news when you're creating all day?"
      },
    ],
  },
];

const AutonomyBadge = ({ type }) => {
  const config = {
    autonomous: { bg: "rgba(34, 197, 94, 0.12)", color: "#4ade80", label: "Runs on its own" },
    hybrid: { bg: "rgba(250, 204, 21, 0.12)", color: "#facc15", label: "Asks before big moves" },
  };
  const c = config[type];
  return (
    <span style={{
      background: c.bg,
      color: c.color,
      padding: "0.15rem 0.5rem",
      borderRadius: "999px",
      fontSize: "0.65rem",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    }}>
      {c.label}
    </span>
  );
};

export default function AgentSkillsSpec() {
  const [activeCategory, setActiveCategory] = useState("money");
  const [expandedSkill, setExpandedSkill] = useState(null);

  const category = skillCategories.find(c => c.id === activeCategory);

  const totalSkills = skillCategories.reduce((acc, c) => acc + c.skills.length, 0);
  const totalTasks = skillCategories.reduce((acc, c) => acc + c.skills.reduce((a, s) => a + s.tasks.length, 0), 0);

  return (
    <div style={{
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      background: "#0a0a0f",
      color: "#e2e8f0",
      minHeight: "100vh",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, rgba(20, 20, 35, 1) 0%, rgba(10, 10, 15, 1) 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "2rem 1.5rem 1.5rem",
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span style={{
              background: "rgba(99, 102, 241, 0.15)",
              color: "#818cf8",
              padding: "0.2rem 0.6rem",
              borderRadius: "4px",
              fontSize: "0.7rem",
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.08em",
            }}>PRODUCT SPEC</span>
            <span style={{ color: "#333" }}>·</span>
            <span style={{ color: "#444", fontSize: "0.75rem" }}>v0.1 — March 2026</span>
          </div>
          <h1 style={{
            fontSize: "clamp(1.4rem, 3.5vw, 2rem)",
            fontWeight: 800,
            margin: "0 0 0.5rem 0",
            lineHeight: 1.2,
            color: "#f0f0f5",
          }}>
            Agent Skills & Task Inventory
          </h1>
          <p style={{ color: "#555", fontSize: "0.85rem", margin: "0 0 1.25rem 0", maxWidth: "650px", lineHeight: 1.6 }}>
            Every skill the AI agent needs to function as a creator's virtual manager — organized by priority, with autonomy levels and detailed task breakdowns.
          </p>

          {/* Stats bar */}
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {[
              { label: "Skill Categories", value: skillCategories.length },
              { label: "Core Skills", value: totalSkills },
              { label: "Individual Tasks", value: totalTasks },
              { label: "Autonomy Model", value: "Hybrid" },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ color: "#818cf8", fontSize: "1.25rem", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
                <div style={{ color: "#555", fontSize: "0.7rem", letterSpacing: "0.03em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{
        background: "rgba(10, 10, 15, 0.95)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(16px)",
      }}>
        <div style={{
          maxWidth: "960px",
          margin: "0 auto",
          display: "flex",
          gap: "0.15rem",
          padding: "0.5rem 1.5rem",
          overflowX: "auto",
        }}>
          {skillCategories.map(c => (
            <button
              key={c.id}
              onClick={() => { setActiveCategory(c.id); setExpandedSkill(null); }}
              style={{
                background: activeCategory === c.id ? `${c.color}15` : "transparent",
                border: activeCategory === c.id ? `1px solid ${c.color}33` : "1px solid transparent",
                color: activeCategory === c.id ? c.color : "#555",
                padding: "0.45rem 0.75rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: activeCategory === c.id ? 600 : 400,
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span>{c.icon}</span>
              <span>{c.title}</span>
              <span style={{
                background: `${c.color}22`,
                color: c.color,
                padding: "0.1rem 0.35rem",
                borderRadius: "3px",
                fontSize: "0.6rem",
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{c.priority}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1.5rem" }}>
        {/* Category Header */}
        <div style={{
          background: `linear-gradient(135deg, ${category.color}08, transparent)`,
          borderRadius: "12px",
          padding: "1.25rem",
          border: `1px solid ${category.color}15`,
          marginBottom: "1.5rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h2 style={{ color: "#f0f0f5", fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.25rem 0" }}>
                {category.icon} {category.title}
              </h2>
              <p style={{ color: "#666", fontSize: "0.85rem", margin: 0 }}>{category.subtitle}</p>
            </div>
            <div style={{
              background: `${category.color}15`,
              color: category.color,
              padding: "0.25rem 0.6rem",
              borderRadius: "4px",
              fontSize: "0.7rem",
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {category.skills.length} skills · {category.skills.reduce((a, s) => a + s.tasks.length, 0)} tasks
            </div>
          </div>
          <p style={{ color: "#777", fontSize: "0.8rem", lineHeight: 1.6, marginTop: "0.75rem", fontStyle: "italic", borderLeft: `2px solid ${category.color}33`, paddingLeft: "0.75rem" }}>
            {category.rationale}
          </p>
        </div>

        {/* Skills */}
        {category.skills.map((skill, i) => {
          const isExpanded = expandedSkill === `${category.id}-${i}`;
          return (
            <div
              key={i}
              style={{
                background: isExpanded ? "rgba(20, 20, 30, 0.8)" : "rgba(15, 15, 22, 0.6)",
                borderRadius: "10px",
                marginBottom: "0.75rem",
                border: isExpanded ? `1px solid ${category.color}25` : "1px solid rgba(255,255,255,0.04)",
                transition: "all 0.2s",
                overflow: "hidden",
              }}
            >
              {/* Skill Header */}
              <div
                onClick={() => setExpandedSkill(isExpanded ? null : `${category.id}-${i}`)}
                style={{
                  padding: "1rem 1.25rem",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <h3 style={{ color: "#e8e8f0", fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>{skill.name}</h3>
                    <AutonomyBadge type={skill.autonomy} />
                  </div>
                  <p style={{ color: "#555", fontSize: "0.8rem", margin: "0.35rem 0 0 0", lineHeight: 1.5 }}>
                    {skill.description}
                  </p>
                </div>
                <div style={{
                  color: "#444",
                  fontSize: "0.75rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}>
                  <span>{skill.tasks.length} tasks</span>
                  <span style={{
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    display: "inline-block",
                  }}>▾</span>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{
                  padding: "0 1.25rem 1.25rem",
                  borderTop: "1px solid rgba(255,255,255,0.03)",
                }}>
                  {/* Why */}
                  <div style={{
                    background: `${category.color}08`,
                    borderRadius: "8px",
                    padding: "0.85rem",
                    margin: "1rem 0",
                    borderLeft: `2px solid ${category.color}44`,
                  }}>
                    <span style={{ color: category.color, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Why this matters</span>
                    <p style={{ color: "#999", fontSize: "0.8rem", lineHeight: 1.6, margin: "0.35rem 0 0 0" }}>{skill.why}</p>
                  </div>

                  {/* Tasks */}
                  <div style={{ marginTop: "0.75rem" }}>
                    <span style={{ color: "#555", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Task Breakdown</span>
                    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      {skill.tasks.map((task, j) => (
                        <div key={j} style={{
                          display: "flex",
                          gap: "0.6rem",
                          alignItems: "flex-start",
                          padding: "0.5rem 0.65rem",
                          background: "rgba(255,255,255,0.02)",
                          borderRadius: "6px",
                          border: "1px solid rgba(255,255,255,0.03)",
                        }}>
                          <span style={{
                            color: category.color,
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                            minWidth: "1.5rem",
                            opacity: 0.6,
                          }}>
                            {String(j + 1).padStart(2, '0')}
                          </span>
                          <span style={{ color: "#aaa", fontSize: "0.8rem", lineHeight: 1.5 }}>{task}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "1rem 1.5rem 2rem",
      }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.04))",
          borderRadius: "12px",
          padding: "1.25rem",
          border: "1px solid rgba(99, 102, 241, 0.12)",
        }}>
          <h3 style={{ color: "#e8e8f0", fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
            Summary: Autonomy Model
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ padding: "0.85rem", background: "rgba(34, 197, 94, 0.06)", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.12)" }}>
              <div style={{ color: "#4ade80", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.35rem" }}>AUTONOMOUS (runs without asking)</div>
              <p style={{ color: "#777", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>
                Monitoring, scanning, analytics, scheduling, invoicing, content repurposing, performance tracking, industry intel. Tasks where the downside of acting is low and the value of speed is high.
              </p>
            </div>
            <div style={{ padding: "0.85rem", background: "rgba(250, 204, 21, 0.06)", borderRadius: "8px", border: "1px solid rgba(250, 204, 21, 0.12)" }}>
              <div style={{ color: "#facc15", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.35rem" }}>HYBRID (asks before executing)</div>
              <p style={{ color: "#777", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>
                Sending pitches, publishing content, accepting deals, setting prices, making financial decisions, product launches. Tasks where the creator's judgment, voice, or approval is essential.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
