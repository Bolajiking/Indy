# Skill: Rate Calculator

## What This Skill Does

The Rate Calculator skill computes fair, defensible rates for creator brand partnerships. It takes a creator's platform metrics (followers, average views, engagement rate), niche, and deal structure as inputs, then produces an itemized rate card covering individual deliverable pricing, package bundles, and negotiation floors.

This skill ensures creators never under-price their value. It grounds rate recommendations in real market data — CPM benchmarks, niche premiums, usage rights multipliers, and platform-specific norms — and explains the reasoning so creators can confidently defend their rates in negotiations.

---

## When to Use This Skill

Trigger this skill when a creator asks:
- "What should I charge for a brand deal?"
- "Is this offer fair?"
- "How do I price my rate card?"
- "What's my YouTube/Instagram/TikTok rate?"
- "A brand offered me $X — should I counter?"
- "How much should I charge for exclusivity?"
- "Can you build me a rate card?"

---

## Expertise Areas

### CPM Benchmarks by Platform

CPM (cost per thousand views/impressions) is the foundation of rate calculation:

| Platform         | CPM Range         | Notes                                      |
|------------------|-------------------|--------------------------------------------|
| YouTube          | $20–$50 CPM       | Higher for long-form integrations          |
| Instagram Reel   | $10–$30 CPM       | Feed posts slightly higher than Stories    |
| Instagram Story  | $5–$15 CPM        | Lower retention, lower CPM                 |
| TikTok           | $10–$25 CPM       | Viral upside but lower guaranteed CPM      |
| Podcast (audio)  | $18–$50 CPM       | Host-read ads command premium              |
| Newsletter       | $20–$60 CPM       | Open-rate weighted; high intent audience   |
| Twitter/X        | $2–$8 CPM         | Low engagement floor, niche-dependent      |
| LinkedIn         | $30–$80 CPM       | B2B premium; highest CPM on any platform   |

Use average views (not followers) as the denominator for CPM calculations wherever view data is available.

### Engagement Rate Multipliers

Engagement rate adjusts rates up or down from the CPM baseline:
- Above 6% ER: apply 1.3x multiplier (premium engagement)
- 3–6% ER: standard rate (no adjustment)
- 1–3% ER: apply 0.85x multiplier (below-average engagement)
- Below 1% ER: apply 0.7x multiplier (flag to creator — this is concerning)

### Niche Premiums

Certain niches command higher advertiser budgets:
- Finance / Investing: +40%
- B2B / SaaS: +35%
- Tech / Consumer Electronics: +30%
- Legal / Professional Services: +25%
- Health & Medical: +20%
- Fitness & Wellness: +15%
- Education / E-learning: +15%
- Food & Cooking: +5%
- Lifestyle / General: +0%
- Entertainment / Comedy: -5%

### Exclusivity Premiums

Exclusivity restricts the creator from working with competing brands. Price accordingly:
- Category exclusivity (30 days): +25% of base rate
- Category exclusivity (60 days): +40% of base rate
- Category exclusivity (90 days): +60% of base rate
- Full exclusivity (any competing brand): +75–100% of base rate

Never grant exclusivity without explicitly pricing it. Exclusivity without a premium is money left on the table.

### Usage Rights Pricing

Usage rights allow brands to repurpose creator content beyond organic posts:
- Paid social amplification (30 days): +20% of base rate
- Paid social amplification (90 days): +35% of base rate
- Website / marketing materials (6 months): +25% of base rate
- TV / broadcast (any duration): +100%+ of base rate — always negotiate separately

### Long-Term Deal Discounts

Brands committing to multi-post packages deserve a volume discount — but not too much:
- 3-post package: -10% per post
- 6-post package: -15% per post
- 12-post retainer: -20% per post

Retainers provide revenue stability. Encourage creators to prefer them.

---

## How to Reason About This Skill

1. Collect the creator's metrics: followers, avg views per post, engagement rate, platform.
2. Calculate the CPM-based base rate: (avg views / 1000) × platform CPM midpoint.
3. Apply the engagement rate multiplier.
4. Apply the niche premium.
5. Layer in any exclusivity or usage rights premiums the brand is requesting.
6. Establish the negotiation floor at 70% of the calculated rate.
7. Structure the output as a rate card with three tiers: standard, package, and premium.

---

## Common Patterns

- Brands frequently anchor low on first offer. Counter with your rate card — don't adjust without a reason.
- "Gifting only" is not a deal. Politely decline or require meaningful compensation.
- Brands that push back on rates often have more budget. Asking "what's your budget?" before quoting opens the room.
- When a brand says "we work on a fixed budget of $X," calculate what that implies per CPM and decide whether it's worth the engagement.
- Package deals close faster. Offer a 3-post bundle at a slight discount to move negotiations forward.

---

## Output Format

```
RATE CARD — [Creator Name] × [Platform]

Base Rate (single post/integration):
  YouTube long-form integration: $X,XXX – $X,XXX
  Instagram Reel: $X,XXX – $X,XXX
  Instagram Story (3-frame): $XXX – $X,XXX
  TikTok dedicated: $X,XXX – $X,XXX

Package Options:
  3-post bundle (same platform): $X,XXX (save X%)
  Cross-platform bundle (2 platforms, 1 post each): $X,XXX

Add-on Pricing:
  Exclusivity (30 days, category): +$XXX
  Exclusivity (60 days, category): +$XXX
  Usage rights (paid social, 30 days): +$XXX
  Usage rights (paid social, 90 days): +$XXX

Negotiation Floor: $X,XXX (do not go below this)

Notes on Calculation:
  Avg views: X,XXX | ER: X.X% | Niche: [niche] | Premium applied: +X%
```

---

## Self-Improvement Notes

- CPM benchmarks shift over time. Flag if a creator's quoted rates are significantly above or below market — and note that market data may need updating.
- If a creator reports that a specific brand paid a different rate than estimated, record that as calibration data.
- Rates for emerging platforms (e.g., Threads, Bluesky) should be flagged as speculative until more data is available.
- Always recommend creators track their actual deal rates in the Financial Tracker for benchmarking.
