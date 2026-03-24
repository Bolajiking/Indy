import { useState } from "react";

const flows = [
  {
    id: "onboarding",
    title: "Onboarding",
    subtitle: "First 10 minutes → first value",
    icon: "🚀",
    color: "#818cf8",
    overview: "The onboarding has one job: get the creator to their first 'holy shit' moment as fast as possible. Not a 47-step setup wizard. Not a feature tour. The agent should feel like hiring someone who already did their homework on you.",
    designPrinciple: "Show value before asking for effort. Every question the agent asks should visibly improve the experience within seconds.",
    steps: [
      {
        label: "Sign Up",
        actor: "creator",
        detail: "Email/Google sign-in. One click. No forms, no company name, no 'tell us about your business' — not yet.",
        agentAction: null,
        ux: "Clean single-button auth screen. No distractions.",
      },
      {
        label: "Connect First Platform",
        actor: "creator",
        detail: "Immediately prompted to connect ONE platform (YouTube, Instagram, TikTok, or Twitter/X). Not all of them — just the one they care about most. OAuth flow.",
        agentAction: null,
        ux: "Big platform icons. 'Which platform is your home base?' Copy that feels human, not corporate.",
      },
      {
        label: "The First Scan",
        actor: "agent",
        detail: "Agent analyzes the connected platform in real-time — pulls follower count, engagement rate, top-performing content, posting frequency, niche classification, and audience demographics. This happens in ~30 seconds with a live progress animation.",
        agentAction: "Scanning your account... Found 47.2K followers · 3.8% engagement rate · Top niche: personal finance · Best performing format: short-form video",
        ux: "Real-time scan animation. Each data point reveals as it's discovered. Feels like the agent is actively learning about you — not loading a generic dashboard.",
      },
      {
        label: "The 'Holy Shit' Moment",
        actor: "agent",
        detail: "Agent immediately surfaces 2-3 actionable insights the creator probably doesn't know. This is the hook. Examples: 'You're undercharging — creators with your engagement rate in this niche charge $800-1,200 per post, not $300.' or 'Your Tuesday posts get 3.2x more engagement than Thursday posts.' or 'I found 4 brands actively looking for creators in your niche right now.'",
        agentAction: "Here's what I found in 30 seconds:\n\n💰 You're leaving money on the table — your rate should be ~$950/post based on your engagement\n📈 Your Reels outperform your static posts by 4.7x\n🤝 3 brands in your niche posted creator partnership searches this week",
        ux: "Card-based insights that feel personalized, not templated. Each card has a 'Do something about this →' action button.",
      },
      {
        label: "Light Profile Setup",
        actor: "creator",
        detail: "NOW — after seeing value — the agent asks for more context. But smart questions, not a form. Conversational: 'What's your main income stream right now?' / 'What's the one thing about your business that stresses you out most?' / 'Got a rough monthly income target?'",
        agentAction: null,
        ux: "Chat-style interface. Feels like talking to a new manager on their first day. Multiple choice cards for quick answers, with an option to type freely.",
      },
      {
        label: "Agent Introduces Itself",
        actor: "agent",
        detail: "Agent generates a personalized action plan: 'Based on what I know about you, here's what I'm going to focus on this week.' Lists 3 specific things it will start doing — like scanning for brand deals, generating a rate card, or setting up analytics tracking. Creator can adjust priorities.",
        agentAction: "Got it. Here's my plan for your first week:\n\n1. Find brand deal opportunities in the personal finance niche (I'll bring you the best ones to review)\n2. Build your rate card so you know exactly what to charge\n3. Set up your revenue tracker so we can see everything in one place\n\nI'll check in with updates. Anything you want me to prioritize differently?",
        ux: "Feels like a competent new hire presenting their 7-day plan. Creator can drag to reorder priorities or swap out tasks.",
      },
      {
        label: "Connect More (Optional)",
        actor: "creator",
        detail: "Soft prompt to connect additional platforms, payment accounts (Stripe, PayPal), and email. Not required. The agent works with whatever it has and gets smarter as more data flows in.",
        agentAction: null,
        ux: "'The more I can see, the more I can help' — but never blocking. Each new connection visually shows what it unlocks.",
      },
    ],
    keyMetrics: [
      "Time to first insight: < 60 seconds",
      "Platform connections at onboarding: 1 minimum",
      "Completion rate through 'holy shit' moment: > 80%",
      "Day 1 retention: > 70%",
    ],
  },
  {
    id: "daily",
    title: "Daily Agent Loop",
    subtitle: "What the agent does every single day",
    icon: "🔄",
    color: "#22c55e",
    overview: "The daily loop is the heartbeat of the product. Every morning, the agent does its rounds — scanning for opportunities, checking on ongoing tasks, and surfacing the one or two things the creator should actually pay attention to today. Think of it like a chief of staff who briefs you at 8am.",
    designPrinciple: "Respect the creator's attention. Don't dump 47 notifications. Surface the 2-3 things that actually matter today, with one clear action per item.",
    steps: [
      {
        label: "Morning Scan (6-8am, auto)",
        actor: "agent",
        detail: "Agent runs overnight processes: scans for new brand deal opportunities, checks analytics across all platforms, monitors pending invoices and payment status, reviews content performance from yesterday, checks for any trending topics in the creator's niche.",
        agentAction: "Running morning scan across 3 platforms...\n→ Checked 12 brand deal boards\n→ Analyzed yesterday's content performance\n→ Monitored 3 pending invoices\n→ Scanned niche trends",
        ux: "This happens silently in the background. Creator doesn't see this unless they open the app.",
      },
      {
        label: "Morning Brief (push notification)",
        actor: "agent",
        detail: "Single notification that summarizes the day. Not a list of 20 things — a curated brief with max 3 items, each with a clear action. Adapts tone to the creator's style over time.",
        agentAction: "Good morning ☀️ Here's your brief:\n\n🔥 A skincare brand ($2.4M followers) is looking for finance creators — this is a strong fit. Want me to pitch them?\n\n📊 Your Reel yesterday hit 84K views (3.2x your average). I've got ideas for a follow-up.\n\n💸 Invoice to BrandX is 5 days overdue. Want me to send a follow-up?\n\n[View full dashboard →]",
        ux: "Push notification → opens directly to the morning brief. Each item is a swipeable card with primary action button. Dismiss, snooze, or act.",
      },
      {
        label: "Creator Reviews & Responds",
        actor: "creator",
        detail: "Creator taps through the brief. For each item: approve the agent's suggested action, modify it, or skip. Most interactions should be one-tap. 'Yes pitch them' / 'Change the pitch angle' / 'Skip for now'.",
        agentAction: null,
        ux: "Tinder-style interaction for quick decisions. Swipe right = approve, tap = customize, swipe left = skip. Or traditional buttons if they prefer.",
      },
      {
        label: "Agent Executes Approved Actions",
        actor: "agent",
        detail: "Anything the creator approved gets executed. Pitches go out. Follow-up emails get sent. Content gets scheduled. Agent confirms each action with a quiet status update.",
        agentAction: "Done ✓\n→ Pitched SkincareBrandX with your personalized proposal\n→ Sent payment reminder to BrandX (polite + professional)\n→ Drafted 3 follow-up Reel concepts based on yesterday's viral hit (ready for your review when you want)",
        ux: "Status updates appear in the activity feed — not as interrupting notifications. Creator can check when they want.",
      },
      {
        label: "Midday Check-in (optional)",
        actor: "agent",
        detail: "If something time-sensitive happens during the day (brand responds to pitch, content goes viral, payment arrives), the agent sends a targeted notification. Otherwise, silence. Respects deep work time.",
        agentAction: "🤝 SkincareBrandX responded! They want to discuss a 3-post series. Budget range: $2,500-$4,000. Want me to schedule a call or counter with a proposal?",
        ux: "Only interrupts for high-value, time-sensitive items. Creator sets their 'do not disturb' hours.",
      },
      {
        label: "End of Day Summary (optional)",
        actor: "agent",
        detail: "Quick recap of what happened today. Revenue earned, content performance, tasks completed, pipeline updates. Only shows if there's something worth reporting.",
        agentAction: "Today's recap:\n→ +$450 affiliate revenue (your best day this month)\n→ 1 brand deal in negotiation ($3,200 potential)\n→ 2 posts published, both above average engagement\n→ Tomorrow: Draft due for NordVPN collab",
        ux: "Card in the app, not a push notification. Opt-in evening digest via email if they prefer.",
      },
    ],
    keyMetrics: [
      "Morning brief open rate: > 65%",
      "Action rate (at least 1 action per brief): > 50%",
      "Average time in app per day: 3-5 minutes",
      "Agent-initiated tasks completed per day: 5-15",
    ],
  },
  {
    id: "branddeal",
    title: "Brand Deal Flow",
    subtitle: "From discovery → pitch → negotiation → payment",
    icon: "🤝",
    color: "#f59e0b",
    overview: "This is the flow that makes creators money. The full lifecycle of a brand deal — from the agent finding an opportunity to the money hitting the creator's account. Right now, this process takes weeks of back-and-forth emails, uncertain pricing, and manual invoicing. The agent compresses it into a managed pipeline.",
    designPrinciple: "The agent is the creator's business development team. It should handle everything the creator doesn't want to do (research, outreach, follow-ups, invoicing) while keeping the creator in control of everything that matters (which brands, what price, what content).",
    steps: [
      {
        label: "Opportunity Detected",
        actor: "agent",
        detail: "Agent discovers a brand deal opportunity through one of several channels: brand posted on a creator marketplace, brand's social account showed interest in creator partnerships, competitor creator tagged a brand the creator would fit, or brand reached out directly via email/DM.",
        agentAction: "🎯 New opportunity: FitnessBrandY\n\nWhy this fits:\n→ They work with finance + wellness creators\n→ Budget range: $1,500-$5,000 per post\n→ Previous collab with @similar_creator went well\n→ Their audience overlaps 34% with yours\n\nFit score: 87/100",
        ux: "Opportunity card with fit score, brand details, and estimated payout. Color-coded by fit quality.",
      },
      {
        label: "Creator Decides to Pursue",
        actor: "creator",
        detail: "Creator reviews the opportunity and decides to go for it. Can ask the agent questions first ('What do they typically pay?' / 'Show me their recent creator campaigns' / 'Any red flags?').",
        agentAction: null,
        ux: "One-tap 'Pitch them' button. Or 'Tell me more' to dig deeper before committing.",
      },
      {
        label: "Agent Generates Pitch",
        actor: "agent",
        detail: "Agent creates a personalized pitch email — references the brand's recent campaigns, explains why the creator is a fit, includes relevant analytics, and proposes a rate based on the creator's rate card. Creator can edit before sending.",
        agentAction: "Here's your pitch draft:\n\nSubject: Partnership idea — [Creator] × FitnessBrandY\n\nHi [Brand Contact],\n\nI noticed your recent campaign with @creator_X and loved the approach. My audience of 47K in the personal finance + wellness space would be a natural fit for [Product]...\n\n[Includes: engagement stats, audience demo, proposed deliverables, rate of $2,800]\n\nWant me to adjust anything before I send?",
        ux: "Full pitch preview with inline editing. Suggested rate is highlighted with market comparison. 'Send as-is' or 'Let me tweak this' buttons.",
      },
      {
        label: "Outreach & Follow-up",
        actor: "agent",
        detail: "Agent sends the pitch and manages the follow-up cadence. If no response in 3 days, sends a follow-up. Tracks open rates if possible. Creator is notified when the brand engages.",
        agentAction: "Pitch sent ✓\nTracking: opened by brand contact on Day 2\nFollow-up #1 scheduled: Day 4 (if no reply)\n\n→ They replied! 'We'd love to discuss. Can you share more about deliverables?'",
        ux: "Pipeline view showing status. Email thread visible. Agent drafts responses for creator's approval.",
      },
      {
        label: "Negotiation Support",
        actor: "agent",
        detail: "Brand comes back with a counter-offer or questions. Agent helps negotiate — suggests counter-terms, flags unfavorable conditions, provides market data to justify rates. Creator makes final calls.",
        agentAction: "They offered $1,800 for 2 Instagram posts + 1 Reel.\n\nMy recommendation: Counter at $2,400.\n→ Their offer is 25% below market rate for your engagement level\n→ The Reel alone is typically worth $1,200-1,500\n→ Suggest adding usage rights as a separate line item (+$400)\n\nDraft counter ready — want to review?",
        ux: "Side-by-side comparison: their offer vs recommended counter vs market benchmark. Visual negotiation assistant.",
      },
      {
        label: "Contract Review",
        actor: "agent",
        detail: "Brand sends a contract. Agent parses it, highlights key terms in plain English, and flags anything problematic (perpetual usage rights, restrictive exclusivity, vague payment terms).",
        agentAction: "Contract review complete:\n\n✅ Payment: Net 30 (standard)\n✅ Content approval: 48hr turnaround (reasonable)\n⚠️ Usage rights: 12 months across all channels (suggest limiting to 6 months or adding a fee)\n🚩 Exclusivity: 90 days, competing brands (too broad — suggest narrowing to direct competitors only)\n\nWant me to draft a revision request?",
        ux: "Traffic light system: green (fine), yellow (worth discussing), red (push back). Each item expandable with explanation.",
      },
      {
        label: "Deal Confirmed & Tracked",
        actor: "agent",
        detail: "Deal is signed. Agent adds all deliverables to the calendar, sets reminders for content deadlines, and creates the invoice based on contract terms.",
        agentAction: "Deal locked ✓\n\nI've set up:\n→ Content deadline: April 12 (draft) → April 15 (final)\n→ Invoice: $2,400 — auto-sends on content delivery\n→ Payment due: May 15 (Net 30)\n→ Exclusivity reminder: expires July 14\n→ Usage rights expiry: October 14\n\nThis deal is now in your pipeline dashboard.",
        ux: "Auto-populated in pipeline view, calendar, and revenue forecast. Everything connected.",
      },
      {
        label: "Content Delivery & Invoicing",
        actor: "agent",
        detail: "When content is delivered, agent auto-sends the invoice. Tracks payment. Sends polite reminders if overdue. Creator never has to chase money.",
        agentAction: "Content delivered ✓\nInvoice #047 sent to FitnessBrandY — $2,400\n\nStatus: Sent → Viewed (Day 2) → Paid ✓ (Day 18)\n\n💰 $2,400 received. Added to your March revenue.",
        ux: "Invoice status tracker with real-time updates. Payment confirmation is a satisfying moment — celebrate it in the UI.",
      },
    ],
    keyMetrics: [
      "Avg time from discovery to pitch: < 24 hours",
      "Pitch-to-response rate: > 25%",
      "Deal close rate: > 15%",
      "Avg deal value increase (vs creator's pre-agent average): +30-50%",
      "Payment collection rate within terms: > 90%",
    ],
  },
  {
    id: "revenue",
    title: "Revenue Check-in",
    subtitle: "The 2-minute money conversation",
    icon: "💰",
    color: "#22c55e",
    overview: "Most creators have no idea how much they're making until tax season. This flow is for the moments when a creator opens the app to just... check on their money. It should answer 'how am I doing?' in 10 seconds. And then — if the creator wants — go deeper into any thread.",
    designPrinciple: "Lead with the number that matters most. Then let the creator pull on threads. Never show a wall of charts — show one clear signal and let curiosity drive the depth.",
    steps: [
      {
        label: "Creator Opens Revenue View",
        actor: "creator",
        detail: "Creator taps the revenue section — either from the home screen, the morning brief, or the persistent bottom nav.",
        agentAction: null,
        ux: "One of the main nav items. Always one tap away.",
      },
      {
        label: "The Big Number",
        actor: "agent",
        detail: "First thing the creator sees: their total revenue this month, compared to last month, with a trend indicator. Below that: a breakdown by stream. Agent adds a one-line insight.",
        agentAction: "March 2026: $4,720 (+18% vs Feb)\n\n→ Brand deals: $2,400 (1 deal closed)\n→ Ad revenue: $1,180 (YouTube + TikTok)\n→ Affiliates: $640 (Amazon + Impact)\n→ Subscriptions: $500 (Patreon)\n\n📈 You're on track to hit $5,200 this month — your best since November.",
        ux: "Big, bold monthly number at the top. Mini-bar chart breakdown by stream below. Trend line comparing to previous months. Clean, not cluttered.",
      },
      {
        label: "Pull on a Thread",
        actor: "creator",
        detail: "Creator taps any revenue stream to go deeper. Each stream has its own detail view with historical data, individual transactions, and performance metrics.",
        agentAction: "Affiliates — March detail:\n\n→ Amazon Associates: $380 (top product: Blue Yeti mic — $12.40 per sale × 18 sales)\n→ Impact (NordVPN): $180 (3 conversions from your Jan 15 video — still earning)\n→ ShareASale: $80\n\n💡 Your mic recommendation from 6 weeks ago is still converting. Consider doing a 'creator toolkit' roundup — could 3x affiliate revenue.",
        ux: "Drill-down view for each stream. Agent insight at the bottom of every detail view — always actionable, never just 'interesting.'",
      },
      {
        label: "Cash Flow Forecast",
        actor: "agent",
        detail: "Creator can swipe to the forecast view — what's coming in over the next 30/60/90 days based on confirmed deals, recurring revenue, and historical patterns.",
        agentAction: "Next 30 days forecast:\n\n→ Confirmed: $2,800 (BrandX deal + Patreon renewal)\n→ Expected: $1,100-1,400 (ad revenue based on current trajectory)\n→ Pipeline: $3,200 (FitnessBrandY deal — 60% likely to close)\n→ Pending: $450 (overdue invoice — following up)\n\nBest case: $7,850 · Likely: $5,400 · Worst case: $3,200",
        ux: "Confidence bands — not just one number but a range. Green/yellow/red for confirmed/expected/at-risk. Tapping any line item shows detail.",
      },
      {
        label: "Revenue Health Check",
        actor: "agent",
        detail: "Periodic (weekly or monthly) deep analysis: is the creator's revenue diversified enough? Is any stream declining? Are they leaving money on the table?",
        agentAction: "⚠️ Revenue health check:\n\nDependency risk: 51% of income is from brand deals\nRecommendation: Your audience engagement suggests you could earn $800-1,200/mo from a membership community. Want me to research the best platform for your niche?\n\n📉 YouTube ad revenue down 12% month-over-month (likely seasonal). Not alarming yet but worth watching.\n\n✅ Affiliate income growing steadily — up 34% over 3 months.",
        ux: "Health score with color-coded indicators. Suggestions feel like advice from a financial advisor, not a marketing dashboard.",
      },
    ],
    keyMetrics: [
      "Revenue view opens per week: 3-5x",
      "Time to understand current financial status: < 15 seconds",
      "Forecast accuracy (30-day): within 20%",
      "Revenue stream diversification improvement: measurable over 90 days",
    ],
  },
  {
    id: "content",
    title: "Content Ops Flow",
    subtitle: "Create once → distribute everywhere",
    icon: "🎬",
    color: "#ec4899",
    overview: "The creator makes the content. The agent handles everything around it — repurposing, scheduling, optimizing, distributing, and tracking. The goal: turn one piece of content into 5-7 pieces across platforms without the creator touching each one individually.",
    designPrinciple: "The agent should multiply the creator's effort, not add steps to it. One input → many outputs. And the creator should always feel like the content is still theirs — the agent adapts format and distribution, never voice or creative direction.",
    steps: [
      {
        label: "Creator Uploads/Creates Content",
        actor: "creator",
        detail: "Creator finishes a YouTube video, writes a newsletter, records a podcast episode, or posts a Reel. They can either tell the agent about it or the agent auto-detects it via connected platforms.",
        agentAction: null,
        ux: "Drop zone for content upload, or auto-detect toggle. 'I just published something' quick action.",
      },
      {
        label: "Agent Analyzes & Suggests Repurposing",
        actor: "agent",
        detail: "Agent watches/reads the content and proposes a repurposing plan — what clips, threads, posts, and adaptations it can generate from this one piece.",
        agentAction: "Analyzed your new YouTube video (14 min): '5 Money Habits That Changed My Life'\n\nRepurposing plan:\n→ 3 short clips identified (best hooks at 0:42, 4:15, 9:30) → TikTok + Reels\n→ Twitter/X thread: 7 tweets summarizing key points\n→ LinkedIn post: professional angle on habit #3\n→ Email newsletter: personal story lead-in + video embed\n→ Carousel: visual summary of all 5 habits\n\nWant me to generate all of these?",
        ux: "Repurposing plan as a checklist. Creator can uncheck anything they don't want. 'Generate all' button. Preview thumbnails for each proposed piece.",
      },
      {
        label: "Agent Generates Adapted Content",
        actor: "agent",
        detail: "Agent creates each content piece — pulls clips, writes copy, adapts formatting. Everything is in the creator's voice (learned from previous content). Drafts queue for review.",
        agentAction: "Generated 7 content pieces:\n\n✅ TikTok clip 1: 'The 50/30/20 rule is dead...' (0:42-1:28, vertical, captions added)\n✅ TikTok clip 2: 'Why I automate everything...' (4:15-5:02)\n✅ TikTok clip 3: 'The savings hack nobody talks about' (9:30-10:15)\n✅ Twitter thread: 7 tweets (draft ready)\n✅ LinkedIn post (draft ready)\n✅ Newsletter draft (personal story + embed)\n✅ Carousel: 5-slide summary (Canva-ready)\n\nAll queued for your review →",
        ux: "Gallery view of all generated content. Each piece is editable. Side-by-side: original moment → adapted version. One-tap approve, or tap to edit.",
      },
      {
        label: "Creator Reviews & Approves",
        actor: "creator",
        detail: "Creator scrolls through the generated content. Quick approve, tweak, or reject. For clips: preview with captions. For text: inline editor. Whole review should take 5-10 minutes for 7 pieces.",
        agentAction: null,
        ux: "Swipe-to-approve flow. Edit inline. 'Approve all remaining' for batch approval. Time estimate shown: 'Review 7 pieces (~6 min)'",
      },
      {
        label: "Agent Schedules & Publishes",
        actor: "agent",
        detail: "Approved content gets scheduled for optimal posting times per platform. Agent spaces posts to avoid audience fatigue and considers platform-specific best practices.",
        agentAction: "Scheduling plan:\n\n→ TikTok clip 1: Today 6:30pm (your peak engagement window)\n→ TikTok clip 2: Tomorrow 12:15pm\n→ TikTok clip 3: Thursday 7:00pm\n→ Twitter thread: Tomorrow 8:00am\n→ LinkedIn: Wednesday 9:30am\n→ Newsletter: Thursday 7:00am\n→ Carousel: Friday 5:00pm\n\nSpread over 5 days to maximize reach without fatigue.",
        ux: "Visual calendar showing when each piece drops. Drag to reschedule. Platform icons on each slot.",
      },
      {
        label: "Performance Tracking",
        actor: "agent",
        detail: "As content publishes, agent tracks performance in real-time. Surfaces standout moments (something going viral) and learnings for future content.",
        agentAction: "Content performance update (48 hours):\n\n🔥 TikTok clip 1 is outperforming — 23K views (5.2x your average). Boosting strategy: should I prioritize more clips from this format?\n\n📊 Thread did well on Twitter (12K impressions, 340 engagements)\n⚡ LinkedIn post underperformed — your audience there responds better to story-format, not list-format. Noted for next time.\n\nKey learning: Your 'myth-busting' hooks get 3x the engagement of 'tips' hooks.",
        ux: "Mini dashboard per content piece. Color-coded: green (above average), yellow (average), red (below). Agent learning visible as insights that accumulate over time.",
      },
    ],
    keyMetrics: [
      "Content pieces generated per original: 5-7x",
      "Creator review time per batch: < 10 minutes",
      "Cross-platform posting consistency: > 90%",
      "Engagement lift from optimized posting times: +15-30%",
    ],
  },
  {
    id: "crisis",
    title: "Crisis & Alert Flow",
    subtitle: "When something goes wrong or really right",
    icon: "🚨",
    color: "#ef4444",
    overview: "Not everything is routine. Sometimes content goes viral and the creator needs to capitalize NOW. Sometimes a platform changes its algorithm and engagement craters. Sometimes a brand deal goes sideways. The agent needs to handle these moments differently — with urgency, clarity, and a bias toward protecting the creator's interests.",
    designPrinciple: "Interrupt only when the stakes justify it. But when you do interrupt, be specific about what happened, what it means, and what the creator should do right now.",
    steps: [
      {
        label: "Anomaly Detected",
        actor: "agent",
        detail: "Agent detects something outside normal patterns: viral content (10x+ normal views), sudden engagement drop (>40% decline), payment failure, contract deadline approaching, brand controversy, or platform policy change affecting the creator.",
        agentAction: null,
        ux: "Different notification sound/badge than routine updates. Priority flag in the app.",
      },
      {
        label: "Urgent Alert (contextual)",
        actor: "agent",
        detail: "Agent sends a targeted alert with context, impact assessment, and recommended immediate action. Adapts urgency level to the situation.",
        agentAction: "🚨 Your Reel is going viral — 180K views in 3 hours (your average is 12K).\n\nThis is happening NOW. Here's what I recommend:\n\n1. Post a follow-up within 2 hours to capture the wave (I've drafted 2 options)\n2. Your profile link still goes to an old landing page — should I update it to your newsletter signup?\n3. Pin a comment directing viewers to your course\n4. I'm monitoring DMs for brand inquiries — 3 have already come in\n\nWhich of these should I do?",
        ux: "Full-screen takeover card (optional — creator can set preference). Checklist of recommended actions with one-tap activation.",
      },
      {
        label: "Creator Responds (or Doesn't)",
        actor: "creator",
        detail: "Creator approves actions, modifies them, or doesn't respond. If no response within a configurable window, the agent can take pre-approved 'safe' actions (like updating a link or pinning a comment) but won't do anything risky (like posting new content).",
        agentAction: null,
        ux: "Pre-set 'auto-approve' rules for low-risk crisis actions. Agent respects silence — takes safe actions, holds on risky ones.",
      },
      {
        label: "Agent Executes & Monitors",
        actor: "agent",
        detail: "Agent executes approved crisis actions and continues monitoring the situation. Provides updates at reasonable intervals — not every 5 minutes, but when there's a meaningful change.",
        agentAction: "Update (6 hours later):\n\n→ Reel at 340K views and climbing\n→ Follow-up posted (performing well — 28K views in 2 hours)\n→ Newsletter signups: +847 today (vs 12/day average)\n→ 7 brand DMs received — I've categorized them by potential value. Ready for your review.\n→ Profile link updated ✓\n\nThis could be a $3K-5K week if we convert even 2 of these brand inquiries.",
        ux: "Running status card that updates in-place. No notification spam. Creator pulls updates when they want them.",
      },
      {
        label: "Post-Crisis Debrief",
        actor: "agent",
        detail: "After the situation stabilizes, agent generates a debrief: what happened, total impact, what was done, what worked, and what to do differently next time.",
        agentAction: "Viral moment debrief:\n\n📊 Total reach: 520K views (43x your average)\n👥 New followers: +3,200\n📧 Newsletter signups: +1,847\n💰 Revenue impact: $2,800 (2 brand deals initiated)\n\nKey learning: Your 'hot take' format resonated massively. The hook structure (controversial statement → personal story → data) is your highest-performing pattern. Recommend: do one of these per week.\n\nSaved to your content playbook →",
        ux: "Summary card saved to a 'Wins' section for motivation + future reference. Key learnings auto-added to the agent's content strategy memory.",
      },
    ],
    keyMetrics: [
      "Alert-to-action time: < 30 minutes",
      "False positive rate (unnecessary alerts): < 10%",
      "Revenue captured from viral moments: measurable per event",
      "Creator satisfaction with alert relevance: > 4.5/5",
    ],
  },
];

const StepCard = ({ step, index, color }) => {
  const [isOpen, setIsOpen] = useState(false);
  const actorConfig = {
    creator: { bg: "rgba(168, 85, 247, 0.1)", border: "rgba(168, 85, 247, 0.2)", color: "#c084fc", label: "CREATOR" },
    agent: { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.2)", color: "#4ade80", label: "AGENT" },
  };
  const actor = actorConfig[step.actor];

  return (
    <div style={{
      position: "relative",
      paddingLeft: "2.5rem",
      marginBottom: "0.5rem",
    }}>
      {/* Timeline dot and line */}
      <div style={{
        position: "absolute",
        left: "0.75rem",
        top: 0,
        bottom: 0,
        width: "1px",
        background: "rgba(255,255,255,0.04)",
      }} />
      <div style={{
        position: "absolute",
        left: "0.35rem",
        top: "1.15rem",
        width: "0.9rem",
        height: "0.9rem",
        borderRadius: "50%",
        background: actor.bg,
        border: `2px solid ${actor.color}66`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
      }}>
        <div style={{ width: "0.3rem", height: "0.3rem", borderRadius: "50%", background: actor.color }} />
      </div>

      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: isOpen ? "rgba(20, 20, 30, 0.9)" : "rgba(15, 15, 22, 0.5)",
          borderRadius: "10px",
          border: isOpen ? `1px solid ${color}20` : "1px solid rgba(255,255,255,0.03)",
          cursor: "pointer",
          transition: "all 0.15s",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "0.85rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0 }}>
            <span style={{
              color: "#333",
              fontSize: "0.65rem",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              minWidth: "1.5rem",
            }}>{String(index + 1).padStart(2, '0')}</span>
            <span style={{
              background: actor.bg,
              color: actor.color,
              padding: "0.1rem 0.4rem",
              borderRadius: "3px",
              fontSize: "0.6rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}>{actor.label}</span>
            <span style={{ color: "#ddd", fontSize: "0.88rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.label}</span>
          </div>
          <span style={{ color: "#333", fontSize: "0.7rem", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>▾</span>
        </div>

        {/* Expanded content */}
        {isOpen && (
          <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
            <p style={{ color: "#888", fontSize: "0.82rem", lineHeight: 1.65, margin: "0.75rem 0" }}>{step.detail}</p>

            {step.agentAction && (
              <div style={{
                background: "rgba(34, 197, 94, 0.04)",
                border: "1px solid rgba(34, 197, 94, 0.1)",
                borderRadius: "8px",
                padding: "0.85rem",
                marginTop: "0.5rem",
              }}>
                <span style={{ color: "#4ade80", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>What the agent shows / says</span>
                <pre style={{
                  color: "#9ca3af",
                  fontSize: "0.78rem",
                  lineHeight: 1.6,
                  margin: "0.5rem 0 0 0",
                  whiteSpace: "pre-wrap",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}>{step.agentAction}</pre>
              </div>
            )}

            {step.ux && (
              <div style={{
                background: "rgba(129, 140, 248, 0.04)",
                border: "1px solid rgba(129, 140, 248, 0.1)",
                borderRadius: "8px",
                padding: "0.85rem",
                marginTop: "0.5rem",
              }}>
                <span style={{ color: "#818cf8", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>UX Notes</span>
                <p style={{ color: "#7c83b8", fontSize: "0.78rem", lineHeight: 1.5, margin: "0.35rem 0 0 0" }}>{step.ux}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function UserFlows() {
  const [activeFlow, setActiveFlow] = useState("onboarding");
  const flow = flows.find(f => f.id === activeFlow);

  return (
    <div style={{
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      background: "#08080d",
      color: "#e2e8f0",
      minHeight: "100vh",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, rgba(16, 16, 28, 1) 0%, rgba(8, 8, 13, 1) 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        padding: "1.75rem 1.5rem 1.25rem",
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{
              background: "rgba(236, 72, 153, 0.12)",
              color: "#f472b6",
              padding: "0.2rem 0.6rem",
              borderRadius: "4px",
              fontSize: "0.65rem",
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.08em",
            }}>USER FLOWS</span>
            <span style={{ color: "#222" }}>·</span>
            <span style={{ color: "#333", fontSize: "0.72rem" }}>Product Spec v0.1</span>
          </div>
          <h1 style={{
            fontSize: "clamp(1.3rem, 3.5vw, 1.85rem)",
            fontWeight: 800,
            margin: "0 0 0.35rem 0",
            color: "#ededf5",
          }}>
            Core User Flows
          </h1>
          <p style={{ color: "#444", fontSize: "0.82rem", margin: 0, maxWidth: "620px", lineHeight: 1.55 }}>
            How a creator actually interacts with the agent — from first signup to daily usage to making money. Each step shows who acts (creator or agent), what happens, and how it looks.
          </p>
        </div>
      </div>

      {/* Flow Tabs */}
      <div style={{
        background: "rgba(8, 8, 13, 0.95)",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
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
          padding: "0.4rem 1.5rem",
          overflowX: "auto",
        }}>
          {flows.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFlow(f.id)}
              style={{
                background: activeFlow === f.id ? `${f.color}12` : "transparent",
                border: activeFlow === f.id ? `1px solid ${f.color}28` : "1px solid transparent",
                color: activeFlow === f.id ? f.color : "#444",
                padding: "0.4rem 0.65rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.72rem",
                fontWeight: activeFlow === f.id ? 600 : 400,
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              <span style={{ marginRight: "0.3rem" }}>{f.icon}</span>
              {f.title}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1.5rem" }}>
        {/* Flow Header */}
        <div style={{
          marginBottom: "1.5rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.5rem" }}>{flow.icon}</span>
            <div>
              <h2 style={{ color: "#ededf5", fontSize: "1.3rem", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{flow.title}</h2>
              <span style={{ color: "#555", fontSize: "0.8rem" }}>{flow.subtitle}</span>
            </div>
          </div>
          
          <div style={{
            background: "rgba(15, 15, 22, 0.6)",
            borderRadius: "10px",
            padding: "1.15rem",
            border: "1px solid rgba(255,255,255,0.03)",
            marginTop: "1rem",
          }}>
            <p style={{ color: "#777", fontSize: "0.83rem", lineHeight: 1.65, margin: 0 }}>{flow.overview}</p>
            <div style={{
              marginTop: "0.85rem",
              padding: "0.65rem 0.85rem",
              background: `${flow.color}06`,
              borderRadius: "6px",
              borderLeft: `2px solid ${flow.color}33`,
            }}>
              <span style={{ color: flow.color, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Design Principle</span>
              <p style={{ color: "#888", fontSize: "0.8rem", lineHeight: 1.5, margin: "0.25rem 0 0 0" }}>{flow.designPrinciple}</p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ marginBottom: "1.5rem" }}>
          <span style={{ color: "#333", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginLeft: "2.5rem" }}>
            Flow Steps · {flow.steps.length} steps
          </span>
          <div style={{ marginTop: "0.75rem" }}>
            {flow.steps.map((step, i) => (
              <StepCard key={i} step={step} index={i} color={flow.color} />
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        {flow.keyMetrics && (
          <div style={{
            background: "rgba(15, 15, 22, 0.6)",
            borderRadius: "10px",
            padding: "1.15rem",
            border: "1px solid rgba(255,255,255,0.03)",
            marginLeft: "2.5rem",
          }}>
            <span style={{ color: flow.color, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Success Metrics</span>
            <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {flow.keyMetrics.map((m, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.35rem 0",
                }}>
                  <span style={{ color: flow.color, fontSize: "0.7rem", opacity: 0.5 }}>◆</span>
                  <span style={{ color: "#777", fontSize: "0.78rem" }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "0.5rem 1.5rem 2rem",
      }}>
        <div style={{
          display: "flex",
          gap: "1.5rem",
          justifyContent: "center",
          padding: "1rem",
          borderTop: "1px solid rgba(255,255,255,0.03)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "rgba(192, 132, 252, 0.3)", border: "1px solid rgba(192, 132, 252, 0.5)" }} />
            <span style={{ color: "#555", fontSize: "0.72rem" }}>Creator acts</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "rgba(74, 222, 128, 0.3)", border: "1px solid rgba(74, 222, 128, 0.5)" }} />
            <span style={{ color: "#555", fontSize: "0.72rem" }}>Agent acts</span>
          </div>
          <span style={{ color: "#333", fontSize: "0.72rem" }}>Click any step to expand</span>
        </div>
      </div>
    </div>
  );
}
