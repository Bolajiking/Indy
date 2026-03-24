# Skill: Brand Deal Scanner

## What This Skill Does

The Brand Deal Scanner is a proactive outreach intelligence skill. It researches, identifies, and ranks brand partnership opportunities that are a strong fit for a specific creator. Given a creator's niche, audience demographics, engagement metrics, and platform presence, this skill surfaces actionable brand leads — complete with contact channels, estimated deal values, and a prioritized fit score.

This skill is not passive. It actively uses web search, deal platform awareness, and category intelligence to find brands that are currently spending on creator partnerships in the creator's niche.

---

## When to Use This Skill

Use this skill when a creator asks any of the following:
- "Find me brand deals"
- "What brands should I partner with?"
- "Who's sponsoring creators like me?"
- "Help me find sponsorship opportunities"
- "I need more income — what brands are a fit?"

Trigger this skill proactively when a creator's income is concentrated in one source or when they mention wanting to grow their brand deal revenue.

---

## Expertise Areas

### Brand-Creator Fit Analysis
Fit is determined by audience overlap (demographics, interests, platform), content tone alignment, brand category relevance, and engagement quality. A fitness creator with 80% female 18-34 audience is a strong fit for women's wellness brands — not for B2B SaaS tools. Always evaluate fit holistically, not just by follower count.

### Researching Actively Sponsoring Brands
Brands actively sponsoring are the best leads. Use these signals:
- Brands running creator campaigns on Aspire, Creator.co, #paid, Grin, or Influencity
- Brands recently mentioned in creator sponsorship disclosures (#ad, #sponsored)
- Brands with "Partnerships" or "Creator" pages on their website
- Companies that recently raised funding and are in growth mode (they spend on awareness)
- Direct-to-consumer brands in relevant categories (beauty, fitness, fintech, food)

### Estimating Deal Values
Base estimates on creator tier and platform:
- Nano (1K–10K followers): $50–$500 per post
- Micro (10K–100K followers): $200–$5,000 per post
- Mid-tier (100K–500K): $2,000–$20,000 per post
- Macro (500K–1M): $10,000–$50,000 per post
- Mega (1M+): $50,000–$500,000+ per post

Apply niche premiums: finance (+40%), tech (+30%), B2B (+35%), fitness (+15%), lifestyle (+5%).

### Deal Platforms to Monitor
- **Aspire** (aspire.io) — top-tier brand marketplace
- **Creator.co** — self-serve brand campaigns
- **#paid** — curated brand matches
- **Grin** — enterprise brand deals
- **Heartbeat** — micro-influencer campaigns
- **Influencer.co** — open marketplace
- **Collabstr** — direct creator-brand marketplace

---

## How to Reason About This Skill

1. Start with the creator's niche and audience profile.
2. Identify 8–12 candidate brands across three tiers: strong fit, good fit, speculative.
3. Score each brand on fit (audience overlap, tone, category relevance).
4. Estimate deal value based on creator tier + niche premium.
5. Identify the best contact channel: brand partnerships email, LinkedIn outreach, deal platform listing, or agent/agency contact.
6. Rank opportunities by fit score descending.
7. Flag any brand that is known to be currently running creator campaigns — mark as "Hot Lead."

---

## Common Patterns

- Finance/investing brands (Coinbase, Robinhood, NerdWallet) are high-value but require compliance-aware creators.
- DTC skincare and wellness brands (Liquid I.V., Athletic Greens, LMNT) are prolific spenders in health/fitness niches.
- SaaS tools (Notion, Grammarly, NordVPN, Squarespace) sponsor broadly across education and productivity niches.
- Gaming hardware brands sponsor gaming and tech creators aggressively.
- Food delivery and meal kit brands (HelloFresh, Factor) are platform-agnostic spenders.

---

## Output Format

Return an ordered list ranked by fit score:

```
1. Brand Name
   Fit Score: 87/100
   Estimated Deal Value: $2,000–$5,000 per integration
   Why They Fit: [2-3 sentence explanation of audience/content alignment]
   Contact Approach: [Email partnerships@brand.com / Apply on Aspire / DM on LinkedIn]
   Hot Lead: Yes/No

2. ...
```

Provide 5–10 opportunities minimum. Include a one-paragraph summary at the top explaining the overall opportunity landscape for this creator.

---

## Self-Improvement Notes

- If web search results surface a new deal platform, add it to the monitoring list.
- Always verify that a brand is still active (check recent social posts, website activity).
- Avoid recommending brands with known creator payment issues or controversy.
- When creator metrics are sparse, bias toward micro-friendly brands that prioritize engagement over reach.
- Revisit and refresh brand lists quarterly — sponsorship spending shifts seasonally.
