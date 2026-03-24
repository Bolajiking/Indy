import { useState } from "react";

const skillTiers = [
  {
    id: "p0",
    title: "P0 — The Money Engine",
    subtitle: "Ship first. This is the wedge that justifies the product's existence.",
    color: "#22c55e",
    icon: "💰",
    rationale: "Creators under management earn 3x more. 58.3% face monetization difficulties. 64% want brand deals but can't access them. The agent's #1 job is making creators more money — everything else is retention.",
    skills: [
      {
        name: "Brand Deal Discovery & Matching",
        autonomy: "autonomous",
        description: "Continuously scan brand deal marketplaces, social signals, and brand activity to surface partnership opportunities matched to the creator's niche, audience, and content style.",
        tasks: [
          "Monitor brand deal platforms (AspireIQ, Grin, CreatorIQ, Upfluence) for matching opportunities",
          "Track brands that previously worked with similar creators in the same niche",
          "Analyze brand social accounts to identify companies actively seeking creator partnerships",
          "Score and rank opportunities by fit, payout potential, and brand reputation",
          "Flag time-sensitive opportunities with deadlines",
          "Build a running pipeline of potential brand partners with status tracking",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Scan sync licensing platforms (Musicbed, Artlist, Songtradr) for placement opportunities" },
          { niche: "Filmmakers", variant: "Monitor film distribution platforms and festival submission windows" },
          { niche: "Authors", variant: "Track publisher RFPs, anthology calls, and literary agent interest signals" },
          { niche: "Educators", variant: "Identify corporate training partnerships and platform-sponsored course opportunities" },
          { niche: "Game Devs", variant: "Scan publisher deals, platform featuring opportunities, and bundle invitations" },
        ],
        why: "54-60% of creators say discovery is their biggest pain. The agent flips this from outbound hustle to inbound matching.",
        keyStats: ["64% want brand deals but can't access them", "Creators under management earn 3x more", "Brand deal market: $32.5B (2025) → $40.5B (2026)"],
      },
      {
        name: "Rate Intelligence & Pricing",
        autonomy: "autonomous",
        description: "Benchmark the creator's rates against market data and dynamically recommend what to charge based on niche, platform, engagement rate, and audience demographics.",
        tasks: [
          "Calculate recommended rates per platform (Instagram post, YouTube integration, TikTok, newsletter mention, podcast read, etc.)",
          "Benchmark against creators with similar audience size and engagement in the same niche",
          "Track rate trends over time — alert when the creator is undercharging relative to growth",
          "Generate rate cards formatted for different brand tiers (startup, mid-market, enterprise)",
          "Factor in usage rights, exclusivity periods, and content repurposing into pricing",
          "Provide negotiation talking points when a brand lowballs",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Calculate sync licensing rates by usage type (commercial, film, TV, social media)" },
          { niche: "Authors", variant: "Benchmark advance rates, royalty structures, and speaking fees by genre and audience size" },
          { niche: "Visual Artists", variant: "Price commissions, licensing, and print sales against market rates by medium and style" },
        ],
        why: "Most creators have no idea what to charge. Male creators earn 40% more per collab — partly because of better negotiation. The agent levels this playing field.",
        keyStats: ["40% gender pay gap in creator collaborations", "CPMs vary $2-$75/1K views by niche", "Finance/B2B tech creators earn 5-10x more per view than entertainment"],
      },
      {
        name: "Proposal & Pitch Generation",
        autonomy: "hybrid",
        description: "Auto-draft professional brand deal proposals, sponsorship decks, media kits, and outreach emails tailored to each opportunity.",
        tasks: [
          "Generate personalized pitch emails for outbound brand outreach",
          "Create media kits with auto-pulled analytics, audience demographics, and past work",
          "Draft sponsorship proposals with deliverables, timelines, and pricing tiers",
          "Customize pitch angles based on the brand's recent campaigns and messaging",
          "Generate case studies from past successful brand partnerships",
          "A/B test pitch variations and track response rates",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Generate EPKs (electronic press kits) with streaming stats, press quotes, and tour history" },
          { niche: "Filmmakers", variant: "Draft distribution pitches, festival submission packages, and investor decks" },
          { niche: "Educators", variant: "Create course partnership proposals with student outcome data and completion metrics" },
        ],
        why: "Creators who pitch professionally close 2-3x more deals. But most don't know how to write a pitch deck. The agent becomes their business development arm.",
        keyStats: ["Pitch-to-response rate target: >25%", "Professional pitches close 2-3x more deals"],
      },
      {
        name: "Contract & Deal Review",
        autonomy: "hybrid",
        description: "Analyze brand deal contracts and flag problematic terms — usage rights, exclusivity, payment terms, content ownership, and cancellation clauses.",
        tasks: [
          "Parse contract language and highlight key terms in plain English",
          "Flag unfavorable clauses (perpetual usage rights, long exclusivity, no kill fee)",
          "Compare deal terms against industry standards for the creator's niche and tier",
          "Suggest counter-terms for negotiation with reasoning",
          "Track contract deadlines (deliverable dates, payment milestones, exclusivity expiration)",
          "Maintain a library of contract templates for common deal types",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Review record/distribution deals for master ownership, royalty splits, and reversion clauses" },
          { niche: "Filmmakers", variant: "Analyze distribution agreements for territory rights, revenue waterfalls, and holdback periods" },
          { niche: "Authors", variant: "Review publishing contracts for rights reversion, option clauses, and non-compete terms" },
          { niche: "Visual Artists", variant: "Evaluate licensing agreements for reproduction rights, AI training exclusions, and attribution requirements" },
        ],
        why: "Creators routinely sign away perpetual usage rights or accept bad payment terms because they don't understand contracts. This is where management earns its 20% — and where the agent replaces them.",
        keyStats: ["Management typically takes 15-20% commission", "Snoop Dogg earned only $45K from 1B Spotify streams due to deal structure"],
      },
      {
        name: "Revenue Stream Diversification Advisor",
        autonomy: "hybrid",
        description: "Analyze the creator's current income mix and proactively recommend new revenue streams based on their audience, content type, niche, and growth stage.",
        tasks: [
          "Audit current revenue streams and calculate dependency risk (e.g., '78% of income from one platform')",
          "Recommend new revenue streams based on audience signals and creator strengths",
          "Model projected revenue from each new stream with realistic ramp timelines",
          "Create step-by-step activation plans for each new stream",
          "Set milestones and track progress toward diversification goals",
          "Benchmark revenue mix against top performers in the same niche",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Map the 7-stream model: streaming + sync + merch + live + teaching + production services + direct-to-fan" },
          { niche: "Content Creators", variant: "Plan progression from ad revenue → brand deals → memberships → digital products → community → consulting" },
          { niche: "Authors", variant: "Diversify from book sales → courses → speaking → consulting → newsletter monetization → audiobooks" },
          { niche: "Educators", variant: "Expand from courses → coaching → community → certifications → corporate training → licensing curriculum" },
        ],
        why: "Top earners run 3.3+ streams. Low earners run 2.2. The gap isn't talent — it's strategic awareness. The agent closes this gap.",
        keyStats: ["Top earners: 3.3+ revenue streams", "Low earners: 2.2 streams", "Creators with 7+ streams earn ~$150K+/year", "Those with only 2 rarely exceed $100K"],
      },
    ],
  },
  {
    id: "p1-financial",
    title: "P1 — Financial Operations",
    subtitle: "Turn chaotic creator income into a real business.",
    color: "#818cf8",
    icon: "📊",
    rationale: "Income instability is the #4 pain point. 57% of full-time creators earn below U.S. living wage ($44K). Creators don't have CFOs. Most don't even track their income properly. The agent becomes their financial co-pilot.",
    skills: [
      {
        name: "Income Aggregation & Dashboard",
        autonomy: "autonomous",
        description: "Pull revenue data from all platforms and income sources into a single real-time view with trends and breakdowns.",
        tasks: [
          "Connect to platform APIs (YouTube, TikTok, Instagram, Patreon, Gumroad, Stripe, Spotify, KDP, etc.)",
          "Aggregate ad revenue, brand deal payments, subscription income, product sales, royalties, and tips",
          "Display income by stream, by platform, by month — with trend lines and comparisons",
          "Calculate effective hourly rate per content type",
          "Track year-over-year growth and monthly runway",
          "Generate monthly/quarterly income reports automatically",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Aggregate streaming royalties across DSPs, sync licensing income, live performance fees, and merch sales" },
          { niche: "Authors", variant: "Consolidate royalties across Amazon KDP, IngramSpark, Audible/ACX, and direct sales" },
          { niche: "Filmmakers", variant: "Track distribution revenue across PVOD, streaming licenses, theatrical, and international sales windows" },
        ],
        why: "Most creators have no idea how much they actually make until tax time. Visibility = better decisions.",
        keyStats: ["4% of creators earn over $100K/year", "57% earn below living wage"],
      },
      {
        name: "Cash Flow Forecasting",
        autonomy: "autonomous",
        description: "Predict future income based on historical patterns, confirmed deals, pipeline probability, and seasonal trends.",
        tasks: [
          "Forecast next 30/60/90 day revenue based on pipeline and historical patterns",
          "Flag upcoming cash crunches before they happen",
          "Account for seasonality (Q4 brand deal surge, January slowdown, back-to-school for educators)",
          "Track pending payments and expected settlement dates",
          "Model 'what if' scenarios (what if brand deals drop 30%? what if subscriptions grow 20%?)",
          "Set and track savings goals against projected income",
        ],
        why: "Creator income is spiky. A $5K month followed by a $200 month is normal. The agent smooths the chaos.",
        keyStats: ["Forecast accuracy target: within 20% at 30 days"],
      },
      {
        name: "Invoicing & Payment Collection",
        autonomy: "autonomous",
        description: "Auto-generate invoices from confirmed deal terms, track payment status, and follow up on late payments without the creator chasing.",
        tasks: [
          "Auto-generate branded invoices from confirmed deal terms",
          "Track invoice status (sent, viewed, paid, overdue) with real-time updates",
          "Send automated payment reminders at configurable intervals",
          "Calculate and apply late fees per contract terms",
          "Support multiple currencies and cross-border payment methods (including stablecoin/crypto)",
          "Generate end-of-year payment summaries for tax purposes",
        ],
        why: "Chasing payments is soul-crushing and most creators are bad at it. Automate the awkward conversations.",
        keyStats: ["Payment collection rate target: >90% within terms"],
      },
      {
        name: "Tax Estimation & Expense Tracking",
        autonomy: "hybrid",
        description: "Estimate quarterly tax obligations, track deductible expenses, and prepare for tax season with creator-specific intelligence.",
        tasks: [
          "Calculate estimated quarterly tax payments based on actual earnings and self-employment tax rates",
          "Categorize expenses (equipment, software, travel, home office, production costs) for deduction",
          "Flag potential deductions the creator might be missing",
          "Track business vs personal spending ratios",
          "Generate tax-ready income and expense summaries",
          "Alert when quarterly estimated payments are due",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Track studio rental, instrument purchases, tour expenses, and session musician payments" },
          { niche: "Filmmakers", variant: "Categorize production costs, equipment depreciation, location fees, and crew payments" },
          { niche: "All Niches", variant: "Handle multi-jurisdiction complexity for creators selling across state/country lines" },
        ],
        why: "Freelance/creator taxes are complicated and expensive to mess up. An always-on tax assistant saves thousands.",
        keyStats: ["Self-employment tax rate: 15.3% on top of income tax", "Average creator misses $2K-5K in deductions annually"],
      },
    ],
  },
  {
    id: "p1-content",
    title: "P1 — Content Operations",
    subtitle: "Do more with less — the creator's time is sacred.",
    color: "#f59e0b",
    icon: "🎬",
    rationale: "48% of creators are solo operators. They spend more time on ops than creating. Full-time creators use 3.4 platforms. Manual content adaptation eats 10-15 hours/week. The agent gives them back their time.",
    skills: [
      {
        name: "Content Repurposing Engine",
        autonomy: "autonomous",
        description: "Take one piece of content and automatically generate adapted versions for every relevant platform, preserving the creator's voice while optimizing for each format.",
        tasks: [
          "Convert long-form video → short clips (identify key moments, hooks, highlights)",
          "Transform podcast episodes → Twitter/X threads, LinkedIn posts, blog summaries",
          "Turn blog posts → carousel graphics, email newsletter content, video scripts",
          "Adapt aspect ratios and formats per platform (9:16, 1:1, 16:9)",
          "Generate platform-specific captions, hashtag sets, and descriptions",
          "Queue repurposed content with optimal spacing to avoid audience fatigue",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Extract behind-the-scenes clips, lyric cards, visualizers, and making-of content from studio sessions" },
          { niche: "Authors", variant: "Turn book chapters into blog posts, quote graphics, Twitter threads, and email sequences" },
          { niche: "Filmmakers", variant: "Create trailers, teasers, behind-the-scenes content, and commentary clips from finished films" },
          { niche: "Educators", variant: "Break course modules into free teaser content, infographics, and social proof snippets" },
        ],
        why: "Full-time creators use 3.4 platforms. Manually adapting content for each one eats 10-15 hours/week. The agent turns 1 piece into 7.",
        keyStats: ["Content pieces generated per original: 5-7x target", "Creator review time per batch: <10 minutes target"],
      },
      {
        name: "Content Strategy & Calendar",
        autonomy: "hybrid",
        description: "Plan, schedule, and optimize a content calendar based on audience data, trending topics, seasonal patterns, and revenue goals.",
        tasks: [
          "Generate weekly/monthly content calendars aligned to revenue goals and upcoming launches",
          "Identify trending topics in the creator's niche before they peak",
          "Suggest content themes based on audience engagement patterns and seasonal opportunities",
          "Balance content types (educational, entertaining, promotional, personal)",
          "Schedule posts at optimal times per platform based on historical engagement data",
          "Track content-to-revenue attribution (which posts drive which income)",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Plan release cadence (singles every 4-6 weeks outperforms album drops), coordinate with playlist submission timelines" },
          { niche: "Authors", variant: "Build book launch windows with pre-launch buzz, launch week blitz, and long-tail promotion" },
          { niche: "Game Devs", variant: "Coordinate devlogs, demo releases, wishlist campaigns, and platform featuring windows" },
          { niche: "Educators", variant: "Align content with enrollment windows, back-to-school cycles, and certification deadlines" },
        ],
        why: "Consistency is the #1 predictor of creator growth. But planning content while creating it is exhausting. The agent handles the strategy layer.",
        keyStats: ["Cross-platform posting consistency target: >90%"],
      },
      {
        name: "Performance Analytics & Insights",
        autonomy: "autonomous",
        description: "Aggregate analytics across all platforms into actionable insights — not just numbers, but specific recommendations the creator can act on.",
        tasks: [
          "Pull engagement data from all connected platforms into unified dashboard",
          "Identify top-performing content patterns (format, length, topic, posting time, hook type)",
          "Track audience growth rate, engagement rate, and retention metrics across platforms",
          "Benchmark performance against similar creators in the niche",
          "Generate weekly insight digests with specific recommendations",
          "Flag anomalies (sudden engagement drops, viral moments, algorithm shifts)",
        ],
        why: "84% of creators use AI tools. But most use them for creation, not intelligence. The agent becomes the analytics team.",
        keyStats: ["84% of creators already use AI tools", "Weekly insight digest target: 2-3 actionable recommendations"],
      },
      {
        name: "SEO & Discoverability Optimization",
        autonomy: "autonomous",
        description: "Optimize every piece of content for maximum discoverability — titles, descriptions, tags, thumbnails, metadata, and emerging answer engines.",
        tasks: [
          "Generate SEO-optimized titles, descriptions, and tags for YouTube videos and podcasts",
          "Research and suggest keywords based on search volume and competition in the creator's niche",
          "Optimize blog/newsletter content for search engines and AI answer engines",
          "Analyze thumbnail effectiveness and suggest data-driven improvements",
          "Track search ranking positions for target keywords over time",
          "Adapt content for Answer Engine Optimization (ChatGPT, Perplexity, Google AI Overviews)",
        ],
        nicheVariants: [
          { niche: "Authors", variant: "Optimize Amazon book listings (title, subtitle, keywords, categories, description) for KDP algorithm" },
          { niche: "Educators", variant: "Optimize course titles and descriptions for Udemy/Skillshare search and marketplace algorithms" },
          { niche: "Game Devs", variant: "Optimize Steam store pages, tags, and descriptions for discoverability" },
        ],
        why: "Discovery is the #1 creator challenge (54-60%). SEO is the one channel that compounds over time and isn't algorithm-dependent.",
        keyStats: ["54-60% of creators cite 'getting found' as #1 challenge"],
      },
      {
        name: "Affiliate Strategy Optimization",
        autonomy: "autonomous",
        description: "Find, manage, and optimize affiliate partnerships — matching products to audience, tracking performance, and maximizing commission rates across content.",
        tasks: [
          "Scan affiliate networks (Amazon Associates, Impact, ShareASale, individual brand programs) for high-fit products",
          "Match affiliate products to the creator's content themes and audience purchase behavior",
          "Generate contextual affiliate recommendations for upcoming content",
          "Track affiliate link performance across platforms and content pieces",
          "Identify underperforming affiliates and suggest higher-converting replacements",
          "Negotiate upgraded commission rates based on performance data and volume",
        ],
        why: "Affiliate marketing is hitting $36.9B by 2030. Low earners over-index on affiliates but do it badly. Done right, it's passive income. Done wrong, it's pennies.",
        keyStats: ["Affiliate market: → $36.9B by 2030", "Up to 70% commissions in some programs"],
      },
    ],
  },
  {
    id: "p1-audience",
    title: "P1 — Audience & Community",
    subtitle: "Own the relationship — don't rent it from platforms.",
    color: "#ec4899",
    icon: "👥",
    rationale: "Platform dependency is an existential risk. Algorithm changes can wipe 50-80% of reach overnight. The creators who build owned audiences (email, communities) survive. 56% of creator communities launched in just the last 2 years — this is exploding.",
    skills: [
      {
        name: "Audience Intelligence",
        autonomy: "autonomous",
        description: "Build a deep, cross-platform profile of the creator's audience — who they are, what they want, where they come from, and what they'll pay for.",
        tasks: [
          "Aggregate demographic data across platforms (age, location, interests, active times, devices)",
          "Identify audience segments and their distinct behaviors and value levels",
          "Track which audience segments are most engaged and highest-converting",
          "Monitor DMs, comments, and messages for recurring questions, requests, and pain points",
          "Generate audience persona profiles for brand deal pitches",
          "Predict audience response to new content types or products before launching",
        ],
        why: "Knowing your audience deeply is the difference between a creator and a media business. Most creators guess. The agent knows.",
        keyStats: ["Audience overlap analysis improves collab ROI by 2-3x"],
      },
      {
        name: "Community Building & Management",
        autonomy: "hybrid",
        description: "Help creators establish and grow owned communities — the single most durable audience asset a creator can build.",
        tasks: [
          "Recommend the right community platform based on creator type, audience size, and niche",
          "Set up email capture flows, landing pages, and lead magnets",
          "Draft welcome sequences and onboarding flows for new members",
          "Monitor community health metrics (active members, churn, engagement, NPS)",
          "Generate community content prompts and discussion starters",
          "Identify and surface top community members for ambassador/moderator roles",
        ],
        why: "Community-led businesses are the fastest-growing segment. 56% of creator communities launched in just the last 2 years. The agent is the community operations manager.",
        keyStats: ["Subscription platforms pay out $8B+/yr to creators", "Subscription market: $194B (2025) → $231B (2027)"],
      },
      {
        name: "Email & Direct Communication",
        autonomy: "hybrid",
        description: "Manage the creator's most durable audience channel — newsletters, email sequences, and direct messaging at scale.",
        tasks: [
          "Draft newsletter editions based on recent content, audience interests, and upcoming launches",
          "Set up automated email sequences (welcome, re-engagement, product launch, abandoned cart)",
          "A/B test subject lines, send times, and content formats",
          "Segment email lists by engagement level, interest, and purchase history",
          "Track open rates, click rates, and revenue per email",
          "Generate personalized responses to common DM questions and inquiries at scale",
        ],
        why: "Email is the most durable audience channel. It survives algorithm changes, platform bans, everything. But most creators treat it as an afterthought.",
        keyStats: ["Email generates $36-42 per $1 spent (highest ROI channel)", "Newsletter signups during viral moments: 10-50x normal"],
      },
      {
        name: "Collaboration & Networking",
        autonomy: "hybrid",
        description: "Identify and facilitate creator-to-creator collaborations that grow both audiences — one of the fastest organic growth levers available.",
        tasks: [
          "Find complementary creators with similar audience size but different reach and demographics",
          "Score collaboration potential based on audience overlap, content compatibility, and growth trajectory",
          "Draft collaboration proposals and manage outreach logistics",
          "Suggest collaboration formats (guest appearances, joint content, cross-promotion, shared products)",
          "Track collaboration outcomes (audience growth, engagement impact, revenue generated)",
          "Maintain a network map of creator relationships and past collaborations",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Match for features, co-production, playlist swaps, and joint live sessions" },
          { niche: "Podcasters", variant: "Coordinate guest appearances, cross-promotions, and podcast network opportunities" },
          { niche: "Authors", variant: "Facilitate anthology partnerships, cross-promotion, and newsletter swaps" },
          { niche: "Filmmakers", variant: "Connect for co-production, crew sharing, and distribution partnerships" },
        ],
        why: "Collaborations are one of the fastest organic growth levers. But finding the right partner and managing logistics is a pain most creators avoid.",
        keyStats: ["Collabs typically drive 15-40% audience growth spikes"],
      },
    ],
  },
  {
    id: "p2-product",
    title: "P2 — Product & Commerce",
    subtitle: "Help creators build things people actually buy.",
    color: "#06b6d4",
    icon: "🛍️",
    rationale: "45% of full-time creators own a brand — and they earn 2x more. Digital products are the highest-margin revenue stream. Social commerce is projected to hit $23.4B on TikTok alone in 2026. This is where creators become businesses.",
    skills: [
      {
        name: "Product Opportunity Identification",
        autonomy: "hybrid",
        description: "Analyze audience signals, competitor offerings, and market gaps to identify what products or services a creator should build.",
        tasks: [
          "Mine comments, DMs, and community posts for recurring product requests and unmet needs",
          "Analyze competitors' product offerings and pricing in the same niche",
          "Suggest product types based on creator strengths and audience demand",
          "Model revenue potential for each product concept with realistic assumptions",
          "Validate product ideas by running lightweight audience polls or waitlists",
          "Prioritize product roadmap based on effort vs revenue potential matrix",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Identify demand for sample packs, drum kits, presets, tutorials, and production templates" },
          { niche: "Visual Artists", variant: "Surface opportunities for print sales, brushes/presets, templates, and commissioned work tiers" },
          { niche: "Educators", variant: "Map course topic demand, certification opportunities, and cohort-based program potential" },
          { niche: "Content Creators", variant: "Identify merch concepts, digital download opportunities, and community membership tiers" },
        ],
        why: "Most creators know they should sell something but have no idea what. The agent turns audience demand signals into product specs.",
        keyStats: ["45% of full-time creators own a brand", "Brand-owning creators earn roughly 2x more"],
      },
      {
        name: "Product Launch Assistance",
        autonomy: "hybrid",
        description: "Help creators plan and execute product launches — from pre-launch hype to launch week blitz to post-launch optimization.",
        tasks: [
          "Generate launch timelines with pre-launch, launch, and post-launch phases",
          "Draft launch emails, social posts, countdown content, and promotional sequences",
          "Set up waitlists, pre-order pages, and early access flows",
          "Create pricing strategies (launch pricing, bundles, tiers, early bird discounts)",
          "Track launch metrics in real-time and suggest mid-launch adjustments",
          "Generate post-launch retrospectives with lessons and data for next time",
        ],
        why: "A good launch can 10x a product's revenue vs just posting a link. Most creators wing it. The agent runs the launch playbook.",
        keyStats: ["Top courses generate $50K-$500K", "130,000+ creators sell digital products on Payhip alone"],
      },
      {
        name: "Storefront & Commerce Management",
        autonomy: "autonomous",
        description: "Manage the creator's digital storefront across platforms — product listings, social commerce, fulfillment tracking, and customer experience.",
        tasks: [
          "Optimize product listings (titles, descriptions, images, pricing) across platforms",
          "Track sales, refunds, and customer satisfaction per product",
          "Generate automated customer support responses for common product questions",
          "Monitor inventory and fulfillment status for physical products",
          "Suggest upsells, cross-sells, and bundle opportunities based on purchase data",
          "Manage TikTok Shop, Instagram Shopping, and other social commerce channels",
        ],
        why: "Social commerce is exploding — $23.4B on TikTok alone in 2026 (+48% YoY). But managing storefronts across platforms is operationally complex.",
        keyStats: ["TikTok Shop: $23.4B projected (2026)", "Social commerce growing 48% YoY"],
      },
    ],
  },
  {
    id: "p2-admin",
    title: "P2 — Business Administration",
    subtitle: "The boring stuff that makes everything else work.",
    color: "#94a3b8",
    icon: "⚙️",
    rationale: "Solo creators spend 30-50% of their time on admin that doesn't generate revenue. Every hour saved on admin is an hour that can go toward creating, strategizing, or resting. The agent handles the 80% that's routine.",
    skills: [
      {
        name: "Email & Inbox Management",
        autonomy: "hybrid",
        description: "Triage, draft, and manage the creator's business inbox — brand inquiries, fan messages, collaborations, press requests, and administrative correspondence.",
        tasks: [
          "Categorize incoming emails (brand deal, press inquiry, fan mail, collaboration, spam, admin)",
          "Draft responses based on email type and creator's learned communication style",
          "Flag high-priority emails that need personal attention vs routine responses",
          "Auto-respond to common inquiries with templated but personalized replies",
          "Track email response times and set follow-up reminders",
          "Maintain contact lists and CRM for business relationships",
        ],
        why: "Inbox management alone eats 5-10 hours per week for active creators. The agent handles the 80% that's routine.",
        keyStats: ["5-10 hours/week spent on email for active creators"],
      },
      {
        name: "Legal & IP Awareness",
        autonomy: "hybrid",
        description: "Help creators understand and protect their intellectual property, content rights, and business interests across an increasingly complex legal landscape.",
        tasks: [
          "Monitor for unauthorized use of the creator's content across platforms",
          "Track content licensing agreements and expiration dates",
          "Generate basic terms of service and privacy policies for creator websites",
          "Flag when content usage agreements are about to expire or auto-renew",
          "Maintain a registry of all content, its licensing status, and usage rights granted",
          "Alert on regulatory changes affecting creators (FTC disclosure rules, platform policy changes, copyright law updates)",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Monitor for unauthorized sampling, AI-generated covers, and masters ownership disputes" },
          { niche: "Visual Artists", variant: "Track unauthorized reproductions, AI training dataset inclusion, and style copying" },
          { niche: "Authors", variant: "Monitor for plagiarism, unauthorized translations, and AI-generated derivative works" },
          { niche: "Filmmakers", variant: "Track distribution rights, territorial licensing, and content piracy" },
        ],
        why: "Creators are increasingly fighting for content ownership. AI disruption makes this more urgent across every niche. The agent helps them understand what they own and protect it.",
        keyStats: ["Supreme Court 2026 upheld 'human authorship requirement' but enforcement is weak", "Copyright disputes around AI remain legally ambiguous"],
      },
      {
        name: "Scheduling & Calendar Management",
        autonomy: "autonomous",
        description: "Manage the creator's professional calendar — content deadlines, brand deal deliverables, shoots, calls, and creative time blocks.",
        tasks: [
          "Track brand deal deliverable deadlines and send advance reminders",
          "Schedule content shoots and production blocks based on content calendar",
          "Manage meeting requests and availability for brand calls and collaborations",
          "Coordinate schedules for collaborations across time zones",
          "Block creative time and protect it from meeting creep",
          "Sync across personal and business calendars with conflict detection",
        ],
        why: "Creators who treat their time like a business outperform those who wing it. The agent enforces structure without being rigid.",
        keyStats: ["30-50% of creator time spent on non-revenue admin"],
      },
      {
        name: "Competitive & Industry Intelligence",
        autonomy: "autonomous",
        description: "Keep the creator informed about industry trends, competitor moves, platform changes, and emerging opportunities in their niche.",
        tasks: [
          "Monitor competitor creators' content output, growth rates, and monetization moves",
          "Track platform algorithm changes and policy updates as they're announced",
          "Surface industry news and trends relevant to the creator's niche",
          "Alert on new monetization features launched by platforms (YouTube Shopping, TikTok Series, etc.)",
          "Identify emerging platforms or features worth testing early for first-mover advantage",
          "Generate weekly industry briefings tailored to the creator's interests and niche",
        ],
        why: "Creators who stay informed make better strategic decisions. But who has time to read industry news when you're creating all day? The agent is the research analyst.",
        keyStats: ["18% of creators cite algorithm changes as top barrier to growth", "TikTok ownership uncertainty caused ±16.8% swing in sponsored post volume"],
      },
    ],
  },
  {
    id: "new",
    title: "NEW — Research-Driven Additions",
    subtitle: "Skills identified from market research gaps not in the original spec.",
    color: "#a855f7",
    icon: "🔮",
    rationale: "Cross-referencing the market research across all 7 niches revealed critical capability gaps. These skills address structural problems that affect creators across every category — distribution economics, AI disruption, and crisis response.",
    skills: [
      {
        name: "Distribution & Rights Strategy",
        autonomy: "hybrid",
        description: "Help creators plan and execute platform-specific distribution strategies, manage rights across territories, and optimize release economics.",
        tasks: [
          "Plan multi-platform distribution strategy based on content type, audience geography, and revenue goals",
          "Optimize release cadence per niche (singles every 4-6 weeks for musicians, multi-window for filmmakers)",
          "Track royalty statements, reconcile payments across distributors, and flag discrepancies",
          "Manage territorial rights and international distribution opportunities",
          "Compare distribution platform terms (DistroKid vs CD Baby vs TuneCore, KDP vs IngramSpark, etc.)",
          "Model revenue impact of different distribution strategies before committing",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Manage DSP distribution, playlist submission timing, and territory-specific release strategies" },
          { niche: "Filmmakers", variant: "Plan multi-window strategy: theatrical → PVOD (retains up to 80%) → streaming license → international" },
          { niche: "Authors", variant: "Optimize KDP categories/keywords, manage print-on-demand via IngramSpark, and plan audiobook via ACX" },
          { niche: "Game Devs", variant: "Plan Steam release strategy, console porting timing, and bundle/sale participation" },
        ],
        why: "Snoop Dogg earned $45K from 1B Spotify streams. Russ earns $10M/year because he owns everything and controls distribution. The difference is strategy, not talent.",
        keyStats: [
          "Spotify per-stream rate: $0.003-$0.005 — 300K streams needed for $1K",
          "PVOD retains up to 80% of revenue vs ~50% theatrical",
          "KDP royalties: 35-70% vs traditional publishing 10-15%",
          "Steam/Apple/Google take 30% platform fees",
        ],
      },
      {
        name: "AI Content Protection & Provenance",
        autonomy: "autonomous",
        description: "Monitor for AI-generated copies or derivatives of the creator's work, establish human provenance, and track unauthorized AI training usage.",
        tasks: [
          "Scan for AI-generated content that replicates or closely imitates the creator's style or work",
          "Monitor AI training datasets and model outputs for unauthorized inclusion of creator content",
          "Generate and maintain human provenance verification for original content",
          "Track content attribution across AI-powered platforms and search engines",
          "Alert on AI-generated impersonation (deepfake audio, AI art in creator's style, AI-written copies)",
          "Document and timestamp original work creation for copyright protection",
        ],
        nicheVariants: [
          { niche: "Musicians", variant: "Detect AI-generated covers, unauthorized vocal clones, and AI music that mimics artist's production style" },
          { niche: "Visual Artists", variant: "Monitor for AI-generated images trained on artist's work, detect style theft at scale" },
          { niche: "Authors", variant: "Track AI-generated books flooding Amazon that copy themes, titles, or writing patterns" },
          { niche: "Educators", variant: "Identify AI-generated courses that plagiarize curriculum structure or teaching methodology" },
        ],
        why: "Every niche faces AI-driven devaluation. AI image generators trained on artists' work without consent. AI books flooding Amazon. AI music muddying attribution. Creators need defense, not just offense.",
        keyStats: [
          "AI-generated books flooding Amazon marketplace",
          "Copyright Office still unclear on AI style protections",
          "Commission rates declining as clients turn to AI alternatives",
          "Supreme Court 2026 upheld 'human authorship requirement' but enforcement is weak",
        ],
      },
      {
        name: "Crisis & Viral Moment Capitalization",
        autonomy: "hybrid",
        description: "Detect anomalous events — viral content, engagement crashes, payment failures, platform changes — and orchestrate rapid response to capitalize on opportunities or mitigate damage.",
        tasks: [
          "Detect content anomalies: viral moments (10x+ normal views), sudden engagement drops (>40% decline)",
          "Generate immediate action plans during viral moments (follow-up content, profile optimization, brand outreach)",
          "Monitor DMs and brand inquiries during viral events and categorize by potential value",
          "Execute pre-approved low-risk actions without waiting for creator response (update links, pin comments)",
          "Track crisis/viral event impact in real-time with updates at meaningful intervals, not spam",
          "Generate post-event debriefs with total impact, key learnings, and strategy recommendations",
        ],
        why: "The difference between a viral moment and a viral career is what you do in the 2 hours after it happens. Most creators freeze or miss the window entirely.",
        keyStats: [
          "Alert-to-action time target: <30 minutes",
          "False positive rate target: <10%",
          "Viral moment newsletter signup lift: 10-50x normal",
        ],
      },
      {
        name: "Cross-Border Payment & Settlement",
        autonomy: "autonomous",
        description: "Optimize payment flows for creators working across borders — minimizing fees, handling currency conversion, and enabling stablecoin settlement where beneficial.",
        tasks: [
          "Track and compare payment processing fees across methods (wire, PayPal, Stripe, crypto)",
          "Recommend optimal payment methods per brand/client geography",
          "Calculate real-time currency conversion impact and suggest timing for settlements",
          "Facilitate stablecoin (USDC) payments for instant, low-fee cross-border settlement",
          "Monitor payment regulations and compliance requirements per jurisdiction",
          "Generate payment receipts and documentation for international tax compliance",
        ],
        why: "A Nigerian creator getting paid by a U.S. brand loses 10-30% to middlemen. Cross-border payments are broken. Stablecoin settlement via smart contracts enables instant, transparent payment at near-zero cost.",
        keyStats: [
          "Cross-border creator payments lose 10-30% to intermediaries",
          "150M+ digital creators in Asia-Pacific alone",
          "Africa/LATAM: massive youth populations, mobile-first, payment infrastructure gaps = opportunity",
        ],
      },
    ],
  },
];

const autonomyConfig = {
  autonomous: { bg: "rgba(34, 197, 94, 0.12)", color: "#4ade80", label: "Runs on its own" },
  hybrid: { bg: "rgba(250, 204, 21, 0.12)", color: "#facc15", label: "Asks before big moves" },
};

const AutonomyBadge = ({ type }) => {
  const c = autonomyConfig[type];
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

const NicheTag = ({ niche, color }) => (
  <span style={{
    background: `${color}15`,
    color: color,
    padding: "0.12rem 0.45rem",
    borderRadius: "4px",
    fontSize: "0.62rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
  }}>
    {niche}
  </span>
);

const nicheColors = {
  "Musicians": "#22c55e",
  "Filmmakers": "#f59e0b",
  "Authors": "#818cf8",
  "Visual Artists": "#ec4899",
  "Educators": "#06b6d4",
  "Game Devs": "#a855f7",
  "Content Creators": "#f97316",
  "Podcasters": "#ef4444",
  "All Niches": "#94a3b8",
};

export default function ProductSpecSkills() {
  const [activeTier, setActiveTier] = useState("p0");
  const [expandedSkill, setExpandedSkill] = useState(null);
  const [showNicheVariants, setShowNicheVariants] = useState(true);

  const tier = skillTiers.find(t => t.id === activeTier);

  const totalSkills = skillTiers.reduce((acc, t) => acc + t.skills.length, 0);
  const totalTasks = skillTiers.reduce((acc, t) => acc + t.skills.reduce((a, s) => a + s.tasks.length, 0), 0);
  const totalNicheVariants = skillTiers.reduce((acc, t) => acc + t.skills.reduce((a, s) => a + (s.nicheVariants?.length || 0), 0), 0);

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
            <span style={{ color: "#444", fontSize: "0.75rem" }}>v0.2 — March 2026</span>
            <span style={{ color: "#333" }}>·</span>
            <span style={{
              background: "rgba(168, 85, 247, 0.12)",
              color: "#c084fc",
              padding: "0.15rem 0.5rem",
              borderRadius: "4px",
              fontSize: "0.65rem",
              fontWeight: 600,
            }}>RESEARCH-BACKED</span>
          </div>
          <h1 style={{
            fontSize: "clamp(1.4rem, 3.5vw, 2rem)",
            fontWeight: 800,
            margin: "0 0 0.5rem 0",
            lineHeight: 1.2,
            color: "#f0f0f5",
          }}>
            Indyfren Agent Skills Specification
          </h1>
          <p style={{ color: "#555", fontSize: "0.85rem", margin: "0 0 0.35rem 0", maxWidth: "680px", lineHeight: 1.6 }}>
            Complete capability inventory for the AI creator manager — refined against market research across 7 niches (music, film, content, writing, visual art, games, education). Every skill includes niche-specific task variants.
          </p>
          <p style={{ color: "#444", fontSize: "0.78rem", margin: "0 0 1.25rem 0", maxWidth: "680px", lineHeight: 1.5, fontStyle: "italic" }}>
            Positioning: "Your AI manager that helps you make money from your content." Not a content tool. Not a scheduler. A business partner.
          </p>

          {/* Stats bar */}
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {[
              { label: "Skill Tiers", value: skillTiers.length },
              { label: "Core Skills", value: totalSkills },
              { label: "Individual Tasks", value: totalTasks },
              { label: "Niche Variants", value: totalNicheVariants },
              { label: "Niches Covered", value: "7" },
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

      {/* Tier Tabs */}
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
          {skillTiers.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTier(t.id); setExpandedSkill(null); }}
              style={{
                background: activeTier === t.id ? `${t.color}15` : "transparent",
                border: activeTier === t.id ? `1px solid ${t.color}33` : "1px solid transparent",
                color: activeTier === t.id ? t.color : "#555",
                padding: "0.45rem 0.75rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.72rem",
                fontWeight: activeTier === t.id ? 600 : 400,
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span>{t.icon}</span>
              <span>{t.title.split(" — ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1.5rem" }}>
        {/* Tier Header */}
        <div style={{
          background: `linear-gradient(135deg, ${tier.color}08, transparent)`,
          borderRadius: "12px",
          padding: "1.25rem",
          border: `1px solid ${tier.color}15`,
          marginBottom: "1.5rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h2 style={{ color: "#f0f0f5", fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.25rem 0" }}>
                {tier.icon} {tier.title}
              </h2>
              <p style={{ color: "#666", fontSize: "0.85rem", margin: 0 }}>{tier.subtitle}</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <div style={{
                background: `${tier.color}15`,
                color: tier.color,
                padding: "0.25rem 0.6rem",
                borderRadius: "4px",
                fontSize: "0.7rem",
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {tier.skills.length} skills · {tier.skills.reduce((a, s) => a + s.tasks.length, 0)} tasks
              </div>
            </div>
          </div>
          <p style={{ color: "#777", fontSize: "0.8rem", lineHeight: 1.6, marginTop: "0.75rem", fontStyle: "italic", borderLeft: `2px solid ${tier.color}33`, paddingLeft: "0.75rem" }}>
            {tier.rationale}
          </p>
        </div>

        {/* Skills */}
        {tier.skills.map((skill, i) => {
          const skillKey = `${tier.id}-${i}`;
          const isExpanded = expandedSkill === skillKey;
          return (
            <div
              key={i}
              style={{
                background: isExpanded ? "rgba(20, 20, 30, 0.8)" : "rgba(15, 15, 22, 0.6)",
                borderRadius: "10px",
                marginBottom: "0.75rem",
                border: isExpanded ? `1px solid ${tier.color}25` : "1px solid rgba(255,255,255,0.04)",
                transition: "all 0.2s",
                overflow: "hidden",
              }}
            >
              {/* Skill Header */}
              <div
                onClick={() => setExpandedSkill(isExpanded ? null : skillKey)}
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
                    {skill.nicheVariants && (
                      <span style={{
                        background: "rgba(168, 85, 247, 0.1)",
                        color: "#c084fc",
                        padding: "0.12rem 0.4rem",
                        borderRadius: "4px",
                        fontSize: "0.6rem",
                        fontWeight: 600,
                      }}>
                        {skill.nicheVariants.length} niche variants
                      </span>
                    )}
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
                  {/* Why + Key Stats */}
                  <div style={{
                    background: `${tier.color}08`,
                    borderRadius: "8px",
                    padding: "0.85rem",
                    margin: "1rem 0",
                    borderLeft: `2px solid ${tier.color}44`,
                  }}>
                    <span style={{ color: tier.color, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Why this matters</span>
                    <p style={{ color: "#999", fontSize: "0.8rem", lineHeight: 1.6, margin: "0.35rem 0 0 0" }}>{skill.why}</p>
                    {skill.keyStats && (
                      <div style={{ marginTop: "0.65rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                        {skill.keyStats.map((stat, k) => (
                          <span key={k} style={{
                            background: "rgba(255,255,255,0.04)",
                            color: "#888",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.7rem",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}>
                            {stat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Core Tasks */}
                  <div style={{ marginTop: "0.75rem" }}>
                    <span style={{ color: "#555", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Core Tasks</span>
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
                            color: tier.color,
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

                  {/* Niche Variants */}
                  {skill.nicheVariants && showNicheVariants && (
                    <div style={{ marginTop: "1rem" }}>
                      <span style={{ color: "#c084fc", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Niche-Specific Variants</span>
                      <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        {skill.nicheVariants.map((nv, j) => (
                          <div key={j} style={{
                            display: "flex",
                            gap: "0.6rem",
                            alignItems: "flex-start",
                            padding: "0.5rem 0.65rem",
                            background: "rgba(168, 85, 247, 0.04)",
                            borderRadius: "6px",
                            border: "1px solid rgba(168, 85, 247, 0.08)",
                          }}>
                            <NicheTag niche={nv.niche} color={nicheColors[nv.niche] || "#94a3b8"} />
                            <span style={{ color: "#999", fontSize: "0.8rem", lineHeight: 1.5 }}>{nv.variant}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1rem 1.5rem 2rem" }}>
        {/* Niche Coverage Matrix */}
        <div style={{
          background: "linear-gradient(135deg, rgba(168, 85, 247, 0.06), rgba(99, 102, 241, 0.03))",
          borderRadius: "12px",
          padding: "1.25rem",
          border: "1px solid rgba(168, 85, 247, 0.12)",
          marginBottom: "1rem",
        }}>
          <h3 style={{ color: "#e8e8f0", fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
            Niche Coverage
          </h3>
          <p style={{ color: "#666", fontSize: "0.8rem", lineHeight: 1.6, margin: "0 0 0.75rem 0" }}>
            Every core skill works across all 7 niches. Niche variants customize specific tasks for the unique economics, platforms, and workflows of each creator type.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {Object.entries(nicheColors).filter(([k]) => k !== "All Niches").map(([niche, color]) => (
              <div key={niche} style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.35rem 0.6rem",
                background: `${color}10`,
                borderRadius: "6px",
                border: `1px solid ${color}20`,
              }}>
                <div style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: color }} />
                <span style={{ color: "#bbb", fontSize: "0.78rem" }}>{niche}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Autonomy Model */}
        <div style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.04))",
          borderRadius: "12px",
          padding: "1.25rem",
          border: "1px solid rgba(99, 102, 241, 0.12)",
          marginBottom: "1rem",
        }}>
          <h3 style={{ color: "#e8e8f0", fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
            Autonomy Model
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ padding: "0.85rem", background: "rgba(34, 197, 94, 0.06)", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.12)" }}>
              <div style={{ color: "#4ade80", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.35rem" }}>AUTONOMOUS — runs without asking</div>
              <p style={{ color: "#777", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>
                Monitoring, scanning, analytics, scheduling, invoicing, content repurposing, performance tracking, industry intel, distribution tracking, AI content monitoring. Low downside risk, high speed value.
              </p>
            </div>
            <div style={{ padding: "0.85rem", background: "rgba(250, 204, 21, 0.06)", borderRadius: "8px", border: "1px solid rgba(250, 204, 21, 0.12)" }}>
              <div style={{ color: "#facc15", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.35rem" }}>HYBRID — asks before executing</div>
              <p style={{ color: "#777", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>
                Sending pitches, publishing content, accepting deals, setting prices, making financial decisions, product launches, contract responses, crisis actions. Creator voice, judgment, or approval essential.
              </p>
            </div>
          </div>
        </div>

        {/* Phased Rollout */}
        <div style={{
          background: "rgba(15, 15, 22, 0.6)",
          borderRadius: "12px",
          padding: "1.25rem",
          border: "1px solid rgba(255,255,255,0.04)",
          marginBottom: "1rem",
        }}>
          <h3 style={{ color: "#e8e8f0", fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
            Phased Rollout
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {[
              { phase: "Phase 1: Money Agent", timeline: "MVP → Month 3", skills: "5 P0 skills", color: "#22c55e", desc: "Brand deals, pricing, pitching, contracts, diversification. The wedge that proves the product." },
              { phase: "Phase 2: Ops Agent", timeline: "Month 3-6", skills: "13 P1 skills", color: "#818cf8", desc: "Financial ops, content ops, audience building. The retention layer that makes creators stick." },
              { phase: "Phase 3: Growth Agent", timeline: "Month 6-12", skills: "11 P2 + NEW skills", color: "#f59e0b", desc: "Products, commerce, admin, distribution, AI protection. The expansion that makes creators scale." },
            ].map((p, i) => (
              <div key={i} style={{
                padding: "1rem",
                background: "rgba(255,255,255,0.02)",
                borderRadius: "8px",
                borderTop: `2px solid ${p.color}`,
                border: `1px solid ${p.color}15`,
              }}>
                <div style={{ color: p.color, fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>{p.phase}</div>
                <div style={{ color: "#555", fontSize: "0.7rem", marginBottom: "0.5rem" }}>{p.timeline} · {p.skills}</div>
                <p style={{ color: "#777", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Onchain Angle */}
        <div style={{
          background: "linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(99, 102, 241, 0.04))",
          borderRadius: "12px",
          padding: "1.25rem",
          border: "1px solid rgba(168, 85, 247, 0.15)",
        }}>
          <h3 style={{ color: "#c4b5fd", fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
            The Onchain Advantage
          </h3>
          <p style={{ color: "#888", fontSize: "0.8rem", lineHeight: 1.6, marginBottom: "0.75rem" }}>
            Three structural creator economy problems that crypto solves better than tradfi — integrated directly into agent skills:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            {[
              { title: "Payments", skill: "Cross-Border Payment & Settlement", desc: "Stablecoin settlement for instant, transparent cross-border payments. Nigerian creator paid by U.S. brand loses 10-30% today." },
              { title: "Ownership", skill: "AI Content Protection & Provenance", desc: "Human provenance verification + onchain content registration. Proof of creation that no AI can fake." },
              { title: "Revenue Splits", skill: "Contract & Deal Review", desc: "Smart contract auto-splitting for collaborations. Transparent, instant, trust-minimized revenue distribution." },
            ].map((a, i) => (
              <div key={i} style={{ padding: "0.85rem", background: "rgba(15, 15, 22, 0.5)", borderRadius: "8px", border: "1px solid rgba(168, 85, 247, 0.1)" }}>
                <div style={{ color: "#c4b5fd", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.15rem" }}>{a.title}</div>
                <div style={{ color: "#666", fontSize: "0.65rem", marginBottom: "0.4rem", fontFamily: "'JetBrains Mono', monospace" }}>→ {a.skill}</div>
                <div style={{ color: "#888", fontSize: "0.78rem", lineHeight: 1.5 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
