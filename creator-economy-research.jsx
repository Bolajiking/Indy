import { useState } from "react";

const sections = [
  {
    id: "market",
    label: "Market Overview",
    icon: "📊",
  },
  {
    id: "revenue",
    label: "Revenue Streams",
    icon: "💰",
  },
  {
    id: "pain",
    label: "Pain Points",
    icon: "🔥",
  },
  {
    id: "opportunity",
    label: "The Opportunity",
    icon: "🎯",
  },
  {
    id: "agent",
    label: "Agent Architecture",
    icon: "🤖",
  },
];

const MarketSection = () => (
  <div>
    <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem", color: "#e2e8f0" }}>
      The Creator Economy in 2026: State of Play
    </h2>
    
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
      {[
        { value: "$250B+", label: "Global market size (2025)", sub: "→ $480B by 2027 (Goldman Sachs)" },
        { value: "207M+", label: "Active creators globally", sub: "50M professional/semi-pro" },
        { value: "23-26%", label: "Annual growth rate (CAGR)", sub: "→ $1T+ by early 2030s" },
        { value: "4%", label: "Earn over $100K/year", sub: "57% earn below living wage" },
      ].map((stat, i) => (
        <div key={i} style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.08))",
          border: "1px solid rgba(99, 102, 241, 0.25)",
          borderRadius: "12px",
          padding: "1.25rem",
        }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#818cf8", fontFamily: "'JetBrains Mono', monospace" }}>{stat.value}</div>
          <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: "0.25rem" }}>{stat.label}</div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.35rem" }}>{stat.sub}</div>
        </div>
      ))}
    </div>

    <div style={{ background: "rgba(30, 41, 59, 0.6)", borderRadius: "12px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
      <h3 style={{ color: "#f8fafc", fontSize: "1.1rem", marginBottom: "1rem", fontWeight: 600 }}>The Wealth Concentration Problem</h3>
      <p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize: "0.9rem" }}>
        Here's the uncomfortable truth sitting underneath all the growth headlines: the creator economy is one of the most lopsided markets in existence. More than half of creators earn under $15,000/year. Nearly half of surveyed creators made less than $500 in 2025. Meanwhile, the top 9% pull six figures or more. There's a specific "monetization barrier" at ~$15K/year — creators who cross it see accelerating returns. Those who don't, plateau and eventually burn out.
      </p>
      <p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize: "0.9rem", marginTop: "0.75rem" }}>
        What separates the top earners? Three things: they go full-time (84% of six-figure creators), they have teams (68%), and they maintain 3.3+ revenue streams vs 2.2 for low earners. In other words — the winners are the ones who figured out how to run a business, not just create content. <strong style={{ color: "#c4b5fd" }}>That's where the AI agent comes in.</strong>
      </p>
    </div>

    <div style={{ background: "rgba(30, 41, 59, 0.6)", borderRadius: "12px", padding: "1.5rem", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
      <h3 style={{ color: "#f8fafc", fontSize: "1.1rem", marginBottom: "1rem", fontWeight: 600 }}>Regional Dynamics</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {[
          { region: "North America", share: "34-37%", note: "Largest market. U.S. alone ~$50.9B in 2024. Most mature influencer ecosystem." },
          { region: "Asia-Pacific", share: "20%+ CAGR", note: "Fastest growing. 150M+ digital creators. India govt launched $1B creator fund." },
          { region: "Europe", share: "~25%", note: "UK leads. 50% of marketers use creator campaigns. Strong regulatory frameworks." },
          { region: "Africa/LATAM", share: "Emerging", note: "Massive youth populations. Mobile-first. Payment infrastructure gaps = opportunity." },
        ].map((r, i) => (
          <div key={i} style={{ padding: "1rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: "8px", border: "1px solid rgba(51, 65, 85, 0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>{r.region}</span>
              <span style={{ color: "#818cf8", fontSize: "0.8rem", fontFamily: "'JetBrains Mono', monospace" }}>{r.share}</span>
            </div>
            <p style={{ color: "#64748b", fontSize: "0.8rem", lineHeight: 1.5 }}>{r.note}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const RevenueSection = () => (
  <div>
    <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem", color: "#e2e8f0" }}>
      How Creators Actually Make Money
    </h2>
    
    <p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize: "0.9rem", marginBottom: "1.5rem" }}>
      Understanding where the money flows is critical for deciding what the agent should optimize first. Not all revenue streams are equal — some scale, some don't, some are fragile, and some are durable.
    </p>

    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
      {[
        {
          stream: "Brand Deals / Sponsorships",
          share: "~59-70%",
          marketSize: "$32.5B (2025) → $40.5B (2026)",
          durability: "Medium",
          scalability: "Medium",
          agentOpportunity: "HIGH",
          detail: "Still the #1 income source. 68.8% of creators cite it as primary. But it's volatile — brands pull back seasonally, rates fluctuate, and 64% of creators WANT brand deals but can't access them. Creators under management earn 3x more. The negotiation and discovery gap is massive.",
          color: "#22c55e",
        },
        {
          stream: "Subscriptions / Memberships",
          share: "Growing fast",
          marketSize: "$194B (2025) → $231B (2027)",
          durability: "High",
          scalability: "High",
          agentOpportunity: "VERY HIGH",
          detail: "Subscription platforms pay out $8B+/yr to creators. This is the stickiest revenue — recurring, predictable, owned. Community-led businesses are the fastest-growing segment. 56% of creator communities launched in just the last 2 years. This is where creator businesses become real businesses.",
          color: "#818cf8",
        },
        {
          stream: "Digital Products (courses, ebooks, templates)",
          share: "Varies",
          marketSize: "$50K-$500K per course possible",
          durability: "High",
          scalability: "Very High",
          agentOpportunity: "HIGH",
          detail: "Scalable and high-margin. Top courses generate $50K-$500K. Over 130,000 creators sell digital products on Payhip alone. The problem: most creators don't know what to build, how to price it, or how to market it. The creation process itself is overwhelming.",
          color: "#f59e0b",
        },
        {
          stream: "Ad Revenue (platform payouts)",
          share: "~24%",
          marketSize: "YouTube alone: $50B+ distributed",
          durability: "Low-Medium",
          scalability: "Medium",
          agentOpportunity: "MEDIUM",
          detail: "YouTube gives 55% rev share. TikTok pays $0.40-$1.00/1K views. Platform-dependent and algorithm-dependent. CPMs vary wildly by niche ($2-$75/1K views). Finance/B2B tech creators earn 5-10x more per view than entertainment creators.",
          color: "#06b6d4",
        },
        {
          stream: "Affiliate Marketing",
          share: "~8%",
          marketSize: "→ $36.9B by 2030",
          durability: "Medium",
          scalability: "High",
          agentOpportunity: "HIGH",
          detail: "Up to 70% commissions in some programs. Low earners over-index on affiliates (easy to set up, low payoff). But done strategically with evergreen commerce content, it becomes passive income. The gap: most creators don't optimize their affiliate strategy.",
          color: "#ec4899",
        },
        {
          stream: "Merch / Physical Products",
          share: "Growing",
          marketSize: "Varies widely",
          durability: "Medium",
          scalability: "Medium",
          agentOpportunity: "MEDIUM",
          detail: "45% of full-time creators own a brand. Those who do earn roughly 2x more. Social commerce is projected to hit $23.4B on TikTok Shop alone in 2026 (+48% YoY). The logistics and design are barriers for most creators.",
          color: "#f97316",
        },
      ].map((s, i) => (
        <div key={i} style={{
          background: "rgba(30, 41, 59, 0.6)",
          borderRadius: "12px",
          padding: "1.25rem",
          border: `1px solid ${s.color}22`,
          borderLeft: `3px solid ${s.color}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <div>
              <h3 style={{ color: "#f8fafc", fontSize: "1rem", fontWeight: 600, margin: 0 }}>{s.stream}</h3>
              <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Revenue share: {s.share} • Market: {s.marketSize}</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <span style={{
                background: `${s.color}22`,
                color: s.color,
                padding: "0.2rem 0.6rem",
                borderRadius: "999px",
                fontSize: "0.7rem",
                fontWeight: 600,
              }}>
                Agent Opp: {s.agentOpportunity}
              </span>
            </div>
          </div>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 1.6, margin: 0 }}>{s.detail}</p>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem" }}>
            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Durability: <span style={{ color: s.durability === "High" || s.durability === "Very High" ? "#22c55e" : s.durability === "Medium" ? "#f59e0b" : "#ef4444" }}>{s.durability}</span></span>
            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Scalability: <span style={{ color: s.scalability === "High" || s.scalability === "Very High" ? "#22c55e" : "#f59e0b" }}>{s.scalability}</span></span>
          </div>
        </div>
      ))}
    </div>

    <div style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.06))", borderRadius: "12px", padding: "1.25rem", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
      <h3 style={{ color: "#c4b5fd", fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>💡 Key Insight for Product Strategy</h3>
      <p style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 1.7, margin: 0 }}>
        Top earners maintain 3.3+ revenue streams. The agent's job isn't to optimize one stream — it's to help creators build, manage, and grow multiple streams simultaneously without burning out. The biggest unlock is helping creators cross the $15K monetization barrier by treating their content like a business from day one.
      </p>
    </div>
  </div>
);

const PainSection = () => (
  <div>
    <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem", color: "#e2e8f0" }}>
      Creator Pain Points: Where the Agent Wins
    </h2>

    <p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize: "0.9rem", marginBottom: "1.5rem" }}>
      These are the problems that keep coming up across every data source. Ranked by frequency, severity, and how well an AI agent could solve them.
    </p>

    {[
      {
        rank: "01",
        pain: "Discovery & Visibility",
        stat: "54-60% of creators say 'getting found' is their #1 challenge",
        severity: "Critical",
        detail: "Content gets buried by algorithms. Creators post into the void. The agent can optimize posting times, hashtags, titles, thumbnails, cross-posting strategy — and over time learn what works for each creator's specific audience.",
        agentRole: "Auto-optimize distribution strategy, A/B test titles/thumbnails, schedule across platforms, track what's working",
      },
      {
        rank: "02",
        pain: "Monetization Confusion",
        stat: "58.3% face recent monetization difficulties; 62.3% can't align content with money",
        severity: "Critical",
        detail: "Most creators don't know how to price their work, which revenue streams to pursue, or how to structure deals. They leave massive money on the table. Creators under management earn 3x more — but most can't afford management.",
        agentRole: "Act as a virtual manager — identify monetization gaps, suggest pricing, draft proposals, find brand deal opportunities, negotiate terms",
      },
      {
        rank: "03",
        pain: "Burnout & Operational Overload",
        stat: "46% say it's hard to succeed; 41% struggle with burnout",
        severity: "High",
        detail: "48% of creators operate completely solo. They're doing content creation, editing, scheduling, community management, invoicing, emails, analytics, and strategy all at once. The operational tax is crushing.",
        agentRole: "Automate routine ops — scheduling, invoicing, email responses, analytics reports, content repurposing — so creators focus on creating",
      },
      {
        rank: "04",
        pain: "Income Instability",
        stat: "57% of full-time creators earn below U.S. living wage ($44K)",
        severity: "High",
        detail: "Revenue is spiky and unpredictable. A viral video pays well one month, then nothing the next. No benefits, no safety net. Creators need financial planning tools built for irregular income.",
        agentRole: "Cash flow forecasting, income diversification planning, tax estimation, savings automation, revenue stream health monitoring",
      },
      {
        rank: "05",
        pain: "Platform Dependency",
        stat: "Algorithm changes can wipe 50-80% of reach overnight",
        severity: "High",
        detail: "Creators build on rented land. TikTok bans, algorithm changes, policy shifts — all existential risks. Smart creators build owned properties (email lists, websites, communities) but most don't know how.",
        agentRole: "Build and maintain owned channels — email lists, community platforms, websites. Migrate audience attention off-platform systematically.",
      },
      {
        rank: "06",
        pain: "Brand Deal Access & Negotiation",
        stat: "Creators under management earn 3x more; most have no management",
        severity: "High",
        detail: "The brand deal market is opaque. Rates aren't transparent. Creators either undercharge or can't access deals at all. The discovery problem is bilateral — brands also can't find the right creators.",
        agentRole: "Inbound/outbound brand deal discovery, rate card generation, contract review, negotiation support, CRM for brand relationships",
      },
      {
        rank: "07",
        pain: "Multi-Platform Complexity",
        stat: "Full-time creators use 3.4 platforms on average",
        severity: "Medium",
        detail: "Content needs to be adapted for each platform's format, algorithm, and audience behavior. What works on YouTube doesn't work on TikTok. Most creators either post the same thing everywhere (suboptimal) or exhaust themselves adapting.",
        agentRole: "Intelligent content repurposing — auto-adapt long-form to shorts, podcasts to threads, videos to carousels. Platform-specific optimization.",
      },
    ].map((p, i) => (
      <div key={i} style={{
        background: "rgba(30, 41, 59, 0.6)",
        borderRadius: "12px",
        padding: "1.25rem",
        marginBottom: "1rem",
        border: "1px solid rgba(51, 65, 85, 0.5)",
      }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            color: "#f87171",
            width: "2.5rem",
            height: "2.5rem",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "0.85rem",
            fontFamily: "'JetBrains Mono', monospace",
            flexShrink: 0,
          }}>
            {p.rank}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <h3 style={{ color: "#f8fafc", fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>{p.pain}</h3>
              <span style={{
                background: p.severity === "Critical" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                color: p.severity === "Critical" ? "#f87171" : "#fbbf24",
                padding: "0.15rem 0.5rem",
                borderRadius: "999px",
                fontSize: "0.7rem",
                fontWeight: 600,
              }}>{p.severity}</span>
            </div>
            <p style={{ color: "#818cf8", fontSize: "0.8rem", margin: "0.35rem 0", fontStyle: "italic" }}>{p.stat}</p>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 1.6, margin: "0.5rem 0" }}>{p.detail}</p>
            <div style={{
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.15)",
              borderRadius: "8px",
              padding: "0.75rem",
              marginTop: "0.5rem",
            }}>
              <span style={{ color: "#4ade80", fontSize: "0.75rem", fontWeight: 600 }}>AGENT ROLE → </span>
              <span style={{ color: "#86efac", fontSize: "0.8rem" }}>{p.agentRole}</span>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const OpportunitySection = () => (
  <div>
    <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem", color: "#e2e8f0" }}>
      The Opportunity Matrix: Where to Start
    </h2>

    <p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize: "0.9rem", marginBottom: "1.5rem" }}>
      Based on the research, here's how I'd prioritize the agent's capabilities — scored by revenue impact, market gap, feasibility, and how well AI can actually solve it.
    </p>

    <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid rgba(99, 102, 241, 0.3)" }}>
            {["Category", "Revenue Impact", "Market Gap", "AI Fit", "Priority"].map(h => (
              <th key={h} style={{ color: "#818cf8", textAlign: "left", padding: "0.75rem 0.5rem", fontWeight: 600, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { cat: "Brand Deal Discovery + Negotiation", rev: "★★★★★", gap: "★★★★★", ai: "★★★★☆", priority: "P0", color: "#22c55e" },
            { cat: "Revenue Diversification Engine", rev: "★★★★★", gap: "★★★★☆", ai: "★★★★☆", priority: "P0", color: "#22c55e" },
            { cat: "Content Ops Automation", rev: "★★★★☆", gap: "★★★☆☆", ai: "★★★★★", priority: "P1", color: "#818cf8" },
            { cat: "Financial Management", rev: "★★★★☆", gap: "★★★★☆", ai: "★★★★☆", priority: "P1", color: "#818cf8" },
            { cat: "Community / Audience Ownership", rev: "★★★★☆", gap: "★★★★★", ai: "★★★☆☆", priority: "P1", color: "#818cf8" },
            { cat: "Cross-Platform Distribution", rev: "★★★☆☆", gap: "★★★☆☆", ai: "★★★★★", priority: "P2", color: "#f59e0b" },
            { cat: "Digital Product Creation", rev: "★★★★★", gap: "★★★☆☆", ai: "★★★☆☆", priority: "P2", color: "#f59e0b" },
          ].map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.3)" }}>
              <td style={{ padding: "0.75rem 0.5rem", color: "#e2e8f0", fontWeight: 500 }}>{r.cat}</td>
              <td style={{ padding: "0.75rem 0.5rem", color: "#f59e0b", letterSpacing: "-1px" }}>{r.rev}</td>
              <td style={{ padding: "0.75rem 0.5rem", color: "#f87171", letterSpacing: "-1px" }}>{r.gap}</td>
              <td style={{ padding: "0.75rem 0.5rem", color: "#818cf8", letterSpacing: "-1px" }}>{r.ai}</td>
              <td style={{ padding: "0.75rem 0.5rem" }}>
                <span style={{
                  background: `${r.color}22`,
                  color: r.color,
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{r.priority}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div style={{ background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.03))", borderRadius: "12px", padding: "1.5rem", border: "1px solid rgba(34, 197, 94, 0.2)", marginBottom: "1.5rem" }}>
      <h3 style={{ color: "#4ade80", fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>🎯 The Killer Wedge: "AI Manager for Independent Creators"</h3>
      <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "1rem" }}>
        The data is screaming one thing: creators who have management earn 3x more. But management takes 15-20% and is gatekept to creators who already made it. The biggest market gap isn't another scheduling tool or video editor — it's giving every creator the strategic business layer that only top creators currently have access to.
      </p>
      <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "1rem" }}>
        The agent should be positioned as: <strong style={{ color: "#4ade80" }}>"Your AI manager that helps you make money from your content."</strong> Not a content tool. Not a scheduler. A business partner.
      </p>
      <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.7 }}>
        This framing is important because it justifies a premium price point ($29-99/mo), it aligns with the highest-value pain point (monetization), and it creates a moat — anyone can build a scheduler, but building a holistic business intelligence layer for creators is hard.
      </p>
    </div>

    <div style={{ background: "rgba(30, 41, 59, 0.6)", borderRadius: "12px", padding: "1.5rem", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
      <h3 style={{ color: "#f8fafc", fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Market Sizing: The Addressable Opportunity</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        <div style={{ textAlign: "center", padding: "1rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: "8px" }}>
          <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "0.25rem" }}>TAM</div>
          <div style={{ color: "#818cf8", fontSize: "1.5rem", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>207M</div>
          <div style={{ color: "#64748b", fontSize: "0.7rem" }}>All active creators</div>
        </div>
        <div style={{ textAlign: "center", padding: "1rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: "8px" }}>
          <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "0.25rem" }}>SAM</div>
          <div style={{ color: "#818cf8", fontSize: "1.5rem", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>50M</div>
          <div style={{ color: "#64748b", fontSize: "0.7rem" }}>Professional/semi-pro</div>
        </div>
        <div style={{ textAlign: "center", padding: "1rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: "8px" }}>
          <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "0.25rem" }}>SOM (Year 1)</div>
          <div style={{ color: "#818cf8", fontSize: "1.5rem", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>500K</div>
          <div style={{ color: "#64748b", fontSize: "0.7rem" }}>1% of SAM @ $49/mo = $294M ARR</div>
        </div>
      </div>
    </div>
  </div>
);

const AgentSection = () => (
  <div>
    <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem", color: "#e2e8f0" }}>
      Recommended Agent Architecture
    </h2>

    <p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize: "0.9rem", marginBottom: "1.5rem" }}>
      Based on the research, here's how I'd structure the agent — phased for maximum impact with minimum complexity at launch.
    </p>

    {[
      {
        phase: "Phase 1: The Money Agent",
        timeline: "MVP → 3 months",
        color: "#22c55e",
        modules: [
          { name: "Deal Scout", desc: "Scrapes brand deal opportunities across platforms, matches to creator profile, auto-generates personalized pitches" },
          { name: "Rate Intelligence", desc: "Benchmarks creator's rates against market data by niche, platform, audience size. Tells them what to charge." },
          { name: "Revenue Dashboard", desc: "Aggregates all income streams into one view. Forecasts next 90 days. Flags declining streams." },
          { name: "Proposal Generator", desc: "Auto-drafts brand deal proposals, media kits, and rate cards based on creator's analytics" },
        ],
      },
      {
        phase: "Phase 2: The Ops Agent",
        timeline: "Month 3-6",
        color: "#818cf8",
        modules: [
          { name: "Content Repurposer", desc: "Takes one piece of content and auto-generates versions for each platform (long→short, video→carousel, podcast→thread)" },
          { name: "Schedule Optimizer", desc: "Analyzes engagement patterns and auto-schedules posts for optimal times across all platforms" },
          { name: "Invoice & Payment Tracker", desc: "Auto-generates invoices for brand deals, tracks payment status, sends follow-ups" },
          { name: "Tax Estimator", desc: "Quarterly tax estimates based on actual earnings. Flags deductible expenses." },
        ],
      },
      {
        phase: "Phase 3: The Growth Agent",
        timeline: "Month 6-12",
        color: "#f59e0b",
        modules: [
          { name: "Audience Intelligence", desc: "Analyzes who's engaging, what they want, where they come from. Suggests content strategy shifts." },
          { name: "Community Builder", desc: "Helps creators set up and manage owned communities (email lists, membership platforms, Discord)" },
          { name: "Product Launcher", desc: "Identifies what digital products a creator should build based on audience signals. Assists with creation." },
          { name: "Collab Matchmaker", desc: "Finds complementary creators for collaborations that expand both audiences" },
        ],
      },
    ].map((phase, i) => (
      <div key={i} style={{
        background: "rgba(30, 41, 59, 0.6)",
        borderRadius: "12px",
        padding: "1.5rem",
        marginBottom: "1.25rem",
        border: `1px solid ${phase.color}22`,
        borderTop: `3px solid ${phase.color}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ color: "#f8fafc", fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>{phase.phase}</h3>
          <span style={{
            background: `${phase.color}22`,
            color: phase.color,
            padding: "0.2rem 0.6rem",
            borderRadius: "999px",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}>{phase.timeline}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "0.75rem" }}>
          {phase.modules.map((m, j) => (
            <div key={j} style={{
              background: "rgba(15, 23, 42, 0.5)",
              borderRadius: "8px",
              padding: "1rem",
              border: "1px solid rgba(51, 65, 85, 0.3)",
            }}>
              <div style={{ color: phase.color, fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>{m.name}</div>
              <div style={{ color: "#94a3b8", fontSize: "0.8rem", lineHeight: 1.5 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ))}

    <div style={{
      background: "linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(99, 102, 241, 0.06))",
      borderRadius: "12px",
      padding: "1.5rem",
      border: "1px solid rgba(168, 85, 247, 0.2)",
      marginTop: "1.5rem",
    }}>
      <h3 style={{ color: "#c4b5fd", fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>🔗 The Onchain Angle</h3>
      <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "0.75rem" }}>
        Here's where your thesis connects. The creator economy has three structural problems that crypto can solve better than tradfi:
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
        {[
          { title: "Payments", desc: "Cross-border creator payments are broken. A Nigerian creator getting paid by a U.S. brand loses 10-30% to middlemen. Stablecoin payments via smart contracts = instant, transparent settlement." },
          { title: "Ownership", desc: "Creators don't own their audiences or content provenance. NFTs as human provenance verification + token-gated communities = real ownership." },
          { title: "Revenue Splitting", desc: "Collab revenue splits are manual and trust-based. Smart contracts can auto-split revenue between collaborators, transparently and instantly." },
        ].map((a, i) => (
          <div key={i} style={{ padding: "1rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: "8px" }}>
            <div style={{ color: "#c4b5fd", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>{a.title}</div>
            <div style={{ color: "#94a3b8", fontSize: "0.8rem", lineHeight: 1.5 }}>{a.desc}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const sectionComponents = {
  market: MarketSection,
  revenue: RevenueSection,
  pain: PainSection,
  opportunity: OpportunitySection,
  agent: AgentSection,
};

export default function CreatorEconomyResearch() {
  const [activeSection, setActiveSection] = useState("market");
  const SectionComponent = sectionComponents[activeSection];

  return (
    <div style={{
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      background: "#0f172a",
      color: "#e2e8f0",
      minHeight: "100vh",
      padding: "0",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;800&display=swap" rel="stylesheet" />
      
      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)",
        borderBottom: "1px solid rgba(99, 102, 241, 0.15)",
        padding: "2rem 1.5rem 1rem",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ color: "#818cf8", fontSize: "0.75rem", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Market Research</span>
            <span style={{ color: "#334155" }}>•</span>
            <span style={{ color: "#475569", fontSize: "0.75rem" }}>March 2026</span>
          </div>
          <h1 style={{
            fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
            fontWeight: 800,
            background: "linear-gradient(135deg, #e2e8f0, #818cf8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: "0 0 0.5rem 0",
            lineHeight: 1.2,
          }}>
            AI Agent for Independent Creators
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0, maxWidth: "600px" }}>
            A deep dive into the creator economy's revenue streams, pain points, and where an AI agent creates the most value for global independent creators.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div style={{
        background: "rgba(15, 23, 42, 0.8)",
        borderBottom: "1px solid rgba(51, 65, 85, 0.5)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          maxWidth: "900px",
          margin: "0 auto",
          display: "flex",
          gap: "0.25rem",
          padding: "0.5rem 1.5rem",
          overflowX: "auto",
        }}>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                background: activeSection === s.id ? "rgba(99, 102, 241, 0.15)" : "transparent",
                border: activeSection === s.id ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
                color: activeSection === s.id ? "#818cf8" : "#64748b",
                padding: "0.5rem 0.85rem",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: activeSection === s.id ? 600 : 400,
                whiteSpace: "nowrap",
                transition: "all 0.2s",
                fontFamily: "inherit",
              }}
            >
              <span style={{ marginRight: "0.35rem" }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "2rem 1.5rem",
      }}>
        <SectionComponent />
      </div>

      {/* Footer */}
      <div style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "1.5rem",
        borderTop: "1px solid rgba(51, 65, 85, 0.3)",
      }}>
        <p style={{ color: "#475569", fontSize: "0.75rem", textAlign: "center" }}>
          Sources: Goldman Sachs, SNS Insider, Influencer Marketing Hub, Creator Spotlight, NeoReach, eMarketer, Circle, MBO Partners, Grand View Research, Precedence Research
        </p>
      </div>
    </div>
  );
}
