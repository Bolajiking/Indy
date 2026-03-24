"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/privy";

// ─── Data ─────────────────────────────────────────────────────────────────────

const LIVE_CARDS = [
  {
    label: "Brand match",
    title: "Pitch sent to BeautyBrand",
    detail: "$2,400 deal · fit score 91%",
    accent: "var(--accent-green)",
    accentBg: "var(--accent-green-bg)",
    accentBorder: "var(--accent-green-border)",
  },
  {
    label: "Contract review",
    title: "2 red flags found",
    detail: "Exclusivity clause + late payment penalty",
    accent: "var(--accent-pink)",
    accentBg: "var(--accent-pink-bg)",
    accentBorder: "var(--accent-pink-border)",
  },
  {
    label: "Morning brief",
    title: "3 new brand fits discovered",
    detail: "Finance, wellness, tech — ready to pitch",
    accent: "var(--accent-blue)",
    accentBg: "var(--accent-blue-bg)",
    accentBorder: "var(--accent-blue-border)",
  },
  {
    label: "Revenue update",
    title: "Invoice paid · $1,850",
    detail: "NutriCo brand deal · cleared to wallet",
    accent: "#8b5cf6",
    accentBg: "#f5f3ff",
    accentBorder: "#ddd6fe",
  },
  {
    label: "Rate calculated",
    title: "Recommended rate: $3,200",
    detail: "For a dedicated YouTube integration · 95K avg views",
    accent: "var(--accent-pink)",
    accentBg: "var(--accent-pink-bg)",
    accentBorder: "var(--accent-pink-border)",
  },
];

const CHAT_TABS = [
  {
    label: "Find brand deals",
    prompt: "Find me brand deals for a wellness creator with 80K followers on Instagram",
  },
  {
    label: "Draft a pitch",
    prompt: "Draft a cold pitch email to Athletic Greens for a sponsored YouTube video",
  },
  {
    label: "What should I charge?",
    prompt: "What should I charge for a dedicated integration in a YouTube video with 95K avg views?",
  },
  {
    label: "Plan my day",
    prompt: "Give me a morning brief — what should I prioritize today based on my pipeline?",
  },
];

const DEMO_ITEMS = [
  {
    tab: "Find deals",
    query: "Find me 5 brand deals for a fitness creator with 80K followers",
    response: `Found 5 strong matches for your niche and audience:

1. **Whoop** — Fitness tracker brand · Est. $2,800 · Fit score 94%
   Great alignment with your workout content and engaged audience.

2. **Athletic Greens** — Supplements · Est. $1,900 · Fit score 88%
   High LTV brand, known for fair creator rates.

3. **Gymshark** — Apparel · Est. $3,200 · Fit score 82%
   Actively sourcing UGC creators in the fitness space right now.

Want me to draft pitches for any of these?`,
  },
  {
    tab: "Draft pitch",
    query: "Draft a cold pitch to Athletic Greens",
    response: `**Subject:** Partnership Opportunity — Fitness Creator, 80K Followers

Hi Athletic Greens team,

I'm a fitness creator with 80K engaged followers across Instagram and YouTube, averaging 95K views per video. My audience is highly aligned with your core customer — health-conscious 25-34 year olds who invest in their wellness.

I'd love to explore a sponsored integration where I walk through my daily AG1 routine. I've seen strong engagement on supplement content (avg 6.2% engagement rate).

Would a 30-second dedicated integration in my next upload work for your Q2 calendar?

Looking forward to connecting,
[Your name]

**Estimated rate: $1,900 | Available slots: April & May**`,
  },
  {
    tab: "Review contract",
    query: "Review this contract and flag any red flags",
    response: `Reviewed. Found **2 issues** you should address before signing:

⚠️ **Red flag 1: Exclusivity clause (Section 4.2)**
You'd be locked out of all competitor brands for 6 months after the campaign. This is unusually broad — standard is 30–60 days. Request it be narrowed to 45 days and limited to direct competitors only.

⚠️ **Red flag 2: Late payment terms (Section 7.1)**
Payment is due "within 60 days of deliverable approval." This is too long — negotiate to Net 30 with a 1.5% monthly late fee clause to protect yourself.

Everything else looks standard. Want me to draft a counter-proposal?`,
  },
];

const SKILLS = [
  { name: "Brand Deal Scanner", desc: "Surfaces matching sponsors before your morning coffee." },
  { name: "Rate Calculator", desc: "Know exactly what to charge — backed by real market data." },
  { name: "Pitch Generator", desc: "Personalized outreach drafted in your voice, every time." },
  { name: "Contract Reviewer", desc: "Flags red flags, bad clauses, and unfair terms instantly." },
  { name: "Revenue Advisor", desc: "Turns your income data into a clear growth roadmap." },
  { name: "Financial Tracker", desc: "Every dollar in, every dollar out — always reconciled." },
  { name: "Morning Brief", desc: "Daily digest of deals, tasks, and opportunities waiting on you." },
  { name: "Analytics Aggregator", desc: "Cross-platform stats in one view, no spreadsheets needed." },
  { name: "Content Strategy", desc: "Data-driven content ideas tied to your top-performing niches." },
  { name: "Inbox Triager", desc: "Separates real brand opportunities from noise automatically." },
  { name: "Calendar Manager", desc: "Schedules deliverables, deadlines, and check-ins without friction." },
  { name: "SEO Optimizer", desc: "Makes your content discoverable beyond your existing audience." },
];

const FAQ_ITEMS = [
  {
    q: "How is Indyfren different from ChatGPT?",
    a: "ChatGPT gives you generic advice. Indyfren knows your actual deals, your wallet balance, your audience size, and your history — and it acts on your behalf. It doesn't just answer questions; it scans for deals, drafts pitches, and manages your pipeline 24/7.",
  },
  {
    q: "Does it actually send pitches, or just draft them?",
    a: "Both — your choice. Indyfren drafts every pitch and shows it to you first. You approve before anything is sent. When you approve, it sends on your behalf and tracks replies automatically.",
  },
  {
    q: "How does payment work — do I need a wallet?",
    a: "You start completely free with $10 in agent credits — no wallet, no card required. When you want to use paid actions (like sending emails or enriching brand data), you top up a simple USDC wallet. Every action shows you the cost before it runs.",
  },
  {
    q: "Which platforms does it work with?",
    a: "Instagram, YouTube, TikTok, Twitter/X, and more. Connect your accounts in Settings and Indyfren pulls your analytics, follower data, and engagement rates automatically to build accurate rate cards and find the right brand fits.",
  },
  {
    q: "Is my data private and secure?",
    a: "Yes. Your data is never used to train AI models. Your conversation history, deal data, and wallet are all scoped to your account only. We use Privy for wallet security and all data is encrypted at rest.",
  },
];

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--bg-canvas)",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.5px", color: "var(--text-primary)" }}
        >
          Indyfren
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <a href="#how-it-works" style={{ fontSize: 14, color: "var(--text-tertiary)", fontWeight: 500, padding: "8px 12px" }}>
            How it works
          </a>
          <a href="#pricing" style={{ fontSize: 14, color: "var(--text-tertiary)", fontWeight: 500, padding: "8px 12px" }}>
            Pricing
          </a>
          <Link
            href="/dashboard"
            style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500, padding: "8px 16px", border: "1.5px solid var(--border-default)", borderRadius: "var(--radius-button)", marginLeft: 8 }}
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            style={{ fontSize: 14, color: "white", fontWeight: 600, padding: "8px 18px", background: "var(--accent-blue)", borderRadius: "var(--radius-button)" }}
          >
            Get started free
          </Link>
        </div>

        <button
          className="flex md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
          aria-label="Toggle menu"
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden" style={{ borderTop: "1px solid var(--border-default)", background: "var(--bg-canvas)", padding: "16px 24px" }}>
          <div className="flex flex-col gap-3">
            <a href="#how-it-works" onClick={() => setMenuOpen(false)} style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 500, padding: "8px 0" }}>How it works</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 500, padding: "8px 0" }}>Pricing</a>
            <Link href="/dashboard" style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 500, padding: "8px 0" }}>Sign in</Link>
            <Link href="/dashboard" style={{ fontSize: 15, color: "white", fontWeight: 600, padding: "12px 20px", background: "var(--accent-blue)", borderRadius: "var(--radius-button)", textAlign: "center", marginTop: 4 }}>
              Get started free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Hero Chat Box ─────────────────────────────────────────────────────────────

function HeroChatBox() {
  const { authenticated, login } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [draft, setDraft] = useState(CHAT_TABS[0].prompt);
  const [loading, setLoading] = useState(false);

  function handleTabClick(i: number) {
    setActiveTab(i);
    setDraft(CHAT_TABS[i].prompt);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setLoading(true);

    if (authenticated) {
      router.push("/dashboard?q=" + encodeURIComponent(text));
    } else {
      try { sessionStorage.setItem("indyfren_pending_query", text); } catch {}
      login();
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1.5px solid var(--border-default)",
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
      }}
    >
      {/* Tab chips */}
      <div
        className="flex flex-wrap gap-2 px-4 pt-4"
      >
        {CHAT_TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => handleTabClick(i)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: 99,
              border: activeTab === i
                ? `1.5px solid ${i % 2 === 0 ? "var(--accent-blue-border-strong)" : "var(--accent-pink-border-strong)"}`
                : "1.5px solid var(--border-default)",
              color: activeTab === i
                ? (i % 2 === 0 ? "var(--accent-blue)" : "var(--accent-pink)")
                : "var(--text-tertiary)",
              background: activeTab === i
                ? (i % 2 === 0 ? "var(--accent-blue-bg)" : "var(--accent-pink-bg)")
                : "var(--bg-canvas)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          rows={3}
          placeholder="Ask Indyfren anything about your creator business..."
          suppressHydrationWarning
          style={{
            width: "100%",
            resize: "none",
            border: "1.5px solid var(--border-light)",
            borderRadius: "var(--radius-input)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            fontSize: 14,
            padding: "12px 14px",
            outline: "none",
            lineHeight: 1.6,
          }}
        />
        <div className="mt-3 flex items-center justify-between">
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Free to start · No credit card required
          </p>
          <button
            type="submit"
            disabled={loading || !draft.trim()}
            style={{
              background: "var(--accent-blue)",
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              padding: "10px 20px",
              borderRadius: "var(--radius-button)",
              border: "none",
              cursor: loading || !draft.trim() ? "default" : "pointer",
              opacity: loading || !draft.trim() ? 0.6 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {loading ? "One sec..." : "Ask Indyfren →"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Animated Activity Cards ───────────────────────────────────────────────────

function AnimatedActivityCards() {
  const [visibleStart, setVisibleStart] = useState(0);
  const [fading, setFading] = useState(false);
  const VISIBLE = 3;

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setVisibleStart((s) => (s + 1) % LIVE_CARDS.length);
        setFading(false);
      }, 300);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  const cards = Array.from({ length: VISIBLE }, (_, i) => LIVE_CARDS[(visibleStart + i) % LIVE_CARDS.length]);

  return (
    <div className="flex flex-col gap-3" style={{ transition: "opacity 0.3s ease", opacity: fading ? 0 : 1 }}>
      {cards.map((card, i) => (
        <div
          key={card.title + i}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 16px",
            borderRadius: "var(--radius-card)",
            border: `1px solid ${card.accentBorder}`,
            background: card.accentBg,
            transition: "opacity 0.3s ease",
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: card.accent, flexShrink: 0, marginTop: 5 }} />
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: card.accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
              {card.label}
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{card.title}</p>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{card.detail}</p>
          </div>
        </div>
      ))}

      {/* Live indicator */}
      <div className="flex items-center gap-2 mt-1">
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-green)", display: "inline-block", animation: "pulse 2s infinite" }} />
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
          Indyfren is running for creators right now
        </span>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="px-6 py-16 md:py-24" style={{ background: "var(--bg-canvas)" }}>
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.1fr_0.9fr] md:items-start">

        {/* Left — headline + chat */}
        <div className="space-y-7">
          <div
            style={{
              display: "inline-block",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "5px 12px",
              borderRadius: 99,
              border: "1.5px solid var(--accent-blue-border-strong)",
              color: "var(--accent-blue)",
              background: "var(--accent-blue-bg)",
            }}
          >
            The AI Business Manager for Creators
          </div>

          <h1
            className="text-5xl leading-[0.95] tracking-tight md:text-6xl lg:text-[68px]"
            style={{ fontWeight: 800, color: "var(--text-primary)" }}
          >
            The first AI that{" "}
            <span
              style={{
                background: "var(--gradient-approval)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              works your deals.
            </span>
          </h1>

          <p className="text-base leading-7 md:text-lg" style={{ color: "var(--text-tertiary)", maxWidth: 480 }}>
            Indyfren scouts sponsors, writes pitches, reviews contracts, and tracks
            your revenue — 24/7, while you focus on creating.
          </p>

          <HeroChatBox />
        </div>

        {/* Right — animated cards */}
        <div className="hidden md:block pt-2">
          <AnimatedActivityCards />
        </div>
      </div>
    </section>
  );
}

// ─── Live Ticker ──────────────────────────────────────────────────────────────

function LiveTicker() {
  return (
    <div
      style={{
        borderTop: "1px solid var(--border-default)",
        borderBottom: "1px solid var(--border-default)",
        background: "var(--bg-surface)",
        padding: "12px 24px",
        overflowX: "auto",
      }}
    >
      <div
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 md:gap-10"
        style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}
      >
        {[
          { value: "47", label: "deals discovered today", accent: "var(--accent-green)" },
          { value: "12", label: "pitches sent this week", accent: "var(--accent-blue)" },
          { value: "$38K", label: "in active pipeline", accent: "var(--accent-pink)" },
          { value: "207M", label: "creators in the economy", accent: "#8b5cf6" },
        ].map(({ value, label, accent }) => (
          <div key={label} className="flex items-center gap-2 whitespace-nowrap">
            <span style={{ fontWeight: 800, fontSize: 15, color: accent }}>{value}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Problem ──────────────────────────────────────────────────────────────────

function Problem() {
  return (
    <section
      className="px-6 py-20"
      style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-default)" }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-3xl">
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-pink)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
            The reality
          </p>
          <h2 className="text-3xl leading-tight md:text-4xl" style={{ fontWeight: 800, color: "var(--text-primary)" }}>
            How most creators leave money on the table.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { stat: "57%", label: "earn below living wage", detail: "Creating full-time is harder than anyone admits. The algorithm doesn't pay the bills.", accent: "var(--accent-pink)", border: "var(--accent-pink-border)", bg: "var(--accent-pink-bg)" },
            { stat: "5–15", label: "tools to manage alone", detail: "Dashboards, DMs, invoices, contracts, taxes. No team to handle any of it.", accent: "var(--accent-blue)", border: "var(--accent-blue-border)", bg: "var(--accent-blue-bg)" },
            { stat: "17%", label: "cite missing deals as their #1 barrier", detail: "Not because the deals don't exist — because no one's finding and closing them.", accent: "#8b5cf6", border: "#ddd6fe", bg: "#f5f3ff" },
          ].map(({ stat, label, detail, accent, border, bg }) => (
            <div key={stat} style={{ padding: "28px 24px", borderRadius: "var(--radius-card)", border: `1px solid ${border}`, background: bg }}>
              <p style={{ fontSize: 48, fontWeight: 800, color: accent, lineHeight: 1, marginBottom: 8 }}>{stat}</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>{label}</p>
              <p style={{ fontSize: 14, color: "var(--text-tertiary)", lineHeight: 1.7 }}>{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Agent Demo ───────────────────────────────────────────────────────────────

function AgentDemo() {
  const [activeDemo, setActiveDemo] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const charIndexRef = useRef(0);

  function startStream(demoIndex: number) {
    if (streamRef.current) clearInterval(streamRef.current);
    charIndexRef.current = 0;
    setDisplayedText("");
    setStreaming(true);
    const target = DEMO_ITEMS[demoIndex].response;
    streamRef.current = setInterval(() => {
      charIndexRef.current += 4;
      if (charIndexRef.current >= target.length) {
        setDisplayedText(target);
        setStreaming(false);
        if (streamRef.current) clearInterval(streamRef.current);
      } else {
        setDisplayedText(target.slice(0, charIndexRef.current));
      }
    }, 16);
  }

  // Auto-cycle demos
  useEffect(() => {
    startStream(0);
    const cycleId = setInterval(() => {
      setActiveDemo((prev) => {
        const next = (prev + 1) % DEMO_ITEMS.length;
        startStream(next);
        return next;
      });
    }, 9000);
    return () => {
      clearInterval(cycleId);
      if (streamRef.current) clearInterval(streamRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTabClick(i: number) {
    setActiveDemo(i);
    startStream(i);
  }

  // Render markdown-lite: bold (**text**) and line breaks
  function renderResponse(text: string) {
    return text.split("\n").map((line, li) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={li}>
          {parts.map((part, pi) =>
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={pi}>{part.slice(2, -2)}</strong>
              : part
          )}
          {li < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <section
      className="px-6 py-20"
      style={{ background: "var(--bg-canvas)", borderTop: "1px solid var(--border-default)" }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-2xl">
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-green)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
            Live demo
          </p>
          <h2 className="text-3xl leading-tight md:text-4xl" style={{ fontWeight: 800, color: "var(--text-primary)" }}>
            Your agent, on the job.
          </h2>
          <p className="mt-3 text-base leading-7" style={{ color: "var(--text-tertiary)" }}>
            Watch Indyfren work through real creator business tasks.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {DEMO_ITEMS.map((item, i) => (
            <button
              key={item.tab}
              onClick={() => handleTabClick(i)}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "7px 16px",
                borderRadius: 99,
                border: activeDemo === i ? "1.5px solid var(--accent-blue-border-strong)" : "1.5px solid var(--border-default)",
                color: activeDemo === i ? "var(--accent-blue)" : "var(--text-tertiary)",
                background: activeDemo === i ? "var(--accent-blue-bg)" : "var(--bg-surface)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {item.tab}
            </button>
          ))}
        </div>

        {/* Chat window */}
        <div
          style={{
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
            overflow: "hidden",
          }}
        >
          {/* Window chrome */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-canvas)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent-pink)" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent-green)" }} />
            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>Indyfren · Chat</span>
          </div>

          <div className="space-y-4 p-6">
            {/* User message */}
            <div className="ml-8">
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-input)",
                  fontSize: 14,
                  color: "var(--text-primary)",
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 6 }}>You</p>
                {DEMO_ITEMS[activeDemo].query}
              </div>
            </div>

            {/* Agent response */}
            <div>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-canvas)",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  lineHeight: 1.75,
                  minHeight: 80,
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-blue)", marginBottom: 6 }}>Indyfren</p>
                {renderResponse(displayedText)}
                {streaming && <span style={{ display: "inline-block", width: 2, height: 14, background: "var(--accent-blue)", marginLeft: 2, animation: "pulse 1s infinite" }} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How it Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { number: "01", title: "Tell Indyfren your niche and goals", detail: "A 30-second setup. Your agent learns your audience, rate expectations, and the kinds of brands you want to work with.", time: "30 seconds" },
    { number: "02", title: "Your agent gets to work, 24/7", detail: "Indyfren scans for deals, drafts pitches, monitors your pipeline, reviews incoming contracts, and sends you a morning brief every day.", time: "Always on" },
    { number: "03", title: "You approve. Everything else runs.", detail: "You're always in control. Approve the deals you want. Skip the ones you don't. Indyfren handles the execution — including payment.", time: "Your call" },
  ];

  return (
    <section id="how-it-works" className="px-6 py-20" style={{ background: "var(--gradient-approval)", borderTop: "1px solid var(--border-default)" }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-3xl">
          <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
            How it works
          </p>
          <h2 className="text-3xl leading-tight md:text-4xl" style={{ fontWeight: 800, color: "white" }}>
            From setup to signed deals in 3 steps.
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.number} style={{ position: "relative" }}>
              {i < steps.length - 1 && (
                <div className="hidden md:block" style={{ position: "absolute", top: 28, right: -24, width: 24, height: 2, background: "rgba(255,255,255,0.2)" }} />
              )}
              <div style={{ padding: "28px 24px", borderRadius: "var(--radius-card)", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", borderRadius: 99, padding: "4px 12px", letterSpacing: "0.04em" }}>
                    {step.number}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {step.time}
                  </span>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "white", marginBottom: 10 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Skills Grid ──────────────────────────────────────────────────────────────

function SkillsGrid() {
  return (
    <section className="px-6 py-20" style={{ background: "var(--bg-canvas)", borderTop: "1px solid var(--border-default)" }}>
      <div className="mx-auto max-w-7xl">
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-blue)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          12 specialized skills
        </p>
        <h2 className="mb-4 text-3xl leading-tight md:text-4xl" style={{ fontWeight: 800, color: "var(--text-primary)" }}>
          One agent. Every job your team would do.
        </h2>
        <p className="mb-12 text-base leading-7" style={{ color: "var(--text-tertiary)", maxWidth: 520 }}>
          Each skill is a specialized capability. Together, they run your entire creator business.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SKILLS.map((skill, i) => (
            <div
              key={skill.name}
              style={{
                padding: "20px 18px",
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--border-default)",
                background: i % 5 === 0 ? "var(--accent-blue-bg)" : i % 5 === 2 ? "var(--accent-pink-bg)" : i % 5 === 4 ? "#f5f3ff" : "var(--bg-surface)",
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{skill.name}</p>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.7 }}>{skill.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Social Proof ─────────────────────────────────────────────────────────────

function SocialProof() {
  return (
    <section className="px-6 py-20" style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)" }}>
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-12 text-3xl leading-tight md:text-4xl" style={{ fontWeight: 800, color: "var(--text-primary)", maxWidth: 560 }}>
          Built for the creator who&apos;s done going it alone.
        </h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div style={{ padding: "28px 24px", borderRadius: "var(--radius-card)", border: "1px solid var(--accent-blue-border)", background: "var(--accent-blue-bg)" }}>
            <p style={{ fontSize: 36, fontWeight: 800, color: "var(--accent-blue)", lineHeight: 1, marginBottom: 8 }}>$37B</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>in annual brand investment</p>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.7 }}>Fewer than 3% of creators get their fair share. Indyfren puts you in that room.</p>
          </div>

          <div style={{ padding: "28px 24px", borderRadius: "var(--radius-card)", border: "1px solid var(--accent-green-border)", background: "var(--accent-green-bg)" }}>
            <p style={{ fontSize: 36, fontWeight: 800, color: "var(--accent-green)", lineHeight: 1, marginBottom: 8 }}>3×</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>more income with 7+ revenue streams</p>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.7 }}>Top earners diversify. Indyfren helps you find, track, and scale every stream.</p>
          </div>

          <div style={{ padding: "28px 24px", borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-canvas)" }}>
            <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.8, fontStyle: "italic", marginBottom: 16 }}>
              &ldquo;I used to spend 10 hours a week chasing brand deals. Now Indyfren does it while I film. I signed 3 sponsors last month without sending a single cold DM.&rdquo;
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--gradient-approval)", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>@creator</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Lifestyle creator · 280K followers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="px-6 py-20" style={{ background: "var(--bg-canvas)" }}>
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-green)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Pricing
            </p>
            <h2 className="text-3xl leading-tight md:text-4xl" style={{ fontWeight: 800, color: "var(--text-primary)" }}>
              Start for free. Grow with your deals.
            </h2>
            <p style={{ fontSize: 15, color: "var(--text-tertiary)", lineHeight: 1.8, maxWidth: 440 }}>
              Every new creator gets $10 in agent credits — no credit card, no commitment.
              Use them to scan for deals, draft pitches, and review your first contracts.
            </p>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              Pro tier coming soon — unlimited scans, advanced analytics, and priority agent responses.
            </p>
            <Link
              href="/dashboard"
              style={{ display: "inline-block", fontSize: 15, fontWeight: 700, color: "white", background: "var(--accent-blue)", borderRadius: "var(--radius-button)", padding: "14px 28px" }}
            >
              Start building your creator business →
            </Link>
          </div>

          <div className="grid gap-4">
            <div style={{ padding: "28px 24px", borderRadius: "var(--radius-card)", border: "1.5px solid var(--accent-blue-border-strong)", background: "var(--accent-blue-bg)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Free</p>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-blue)", background: "white", border: "1px solid var(--accent-blue-border)", borderRadius: 99, padding: "3px 10px" }}>Active now</span>
              </div>
              <p style={{ fontSize: 36, fontWeight: 800, color: "var(--accent-blue)", lineHeight: 1, marginBottom: 8 }}>$0</p>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.7 }}>$10 in agent credits on signup. Full access to all 12 skills. No card required.</p>
              <div className="mt-4 space-y-2">
                {["Brand deal scanner", "Pitch generator", "Contract reviewer", "Revenue tracker", "Morning brief"].map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: "var(--accent-green)" }}>✓</span>
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "20px 24px", borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", opacity: 0.7 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Pro</p>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", border: "1px solid var(--border-default)", borderRadius: 99, padding: "3px 10px" }}>Coming soon</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Unlimited agent runs, advanced analytics, priority responses, and more.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="px-6 py-20" style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border-default)" }}>
      <div className="mx-auto max-w-3xl">
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-blue)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
          Questions
        </p>
        <h2 className="mb-10 text-3xl leading-tight md:text-4xl" style={{ fontWeight: 800, color: "var(--text-primary)" }}>
          Everything you need to know.
        </h2>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              style={{
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-canvas)",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{item.q}</span>
                <span style={{ fontSize: 18, color: "var(--text-tertiary)", flexShrink: 0, transform: openIndex === i ? "rotate(45deg)" : "none", transition: "transform 0.2s ease" }}>+</span>
              </button>
              {openIndex === i && (
                <div className="px-6 pb-5" style={{ borderTop: "1px solid var(--border-default)" }}>
                  <p className="pt-4 text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer CTA ───────────────────────────────────────────────────────────────

function FooterCTA() {
  return (
    <section
      className="px-6 py-24 text-center"
      style={{ background: "var(--gradient-approval)", borderTop: "1px solid var(--border-default)" }}
    >
      <div className="mx-auto max-w-3xl">
        <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20 }}>
          Get started
        </p>
        <h2
          className="text-3xl leading-tight md:text-5xl"
          style={{ fontWeight: 800, color: "white", marginBottom: 20 }}
        >
          The only AI agent that works your creator business 24/7.
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", marginBottom: 36, lineHeight: 1.7 }}>
          Free to start. No credit card. $10 in credits on signup.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--accent-blue)",
            background: "white",
            borderRadius: "var(--radius-button)",
            padding: "16px 36px",
          }}
        >
          Get started free →
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border-default)", background: "var(--bg-surface)", padding: "40px 24px" }}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
        <div>
          <p style={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)", marginBottom: 6 }}>Indyfren</p>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>The AI business manager for creators.</p>
        </div>
        <div className="flex flex-wrap gap-6">
          <Link href="/dashboard" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Dashboard</Link>
          <a href="#how-it-works" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>How it works</a>
          <a href="#pricing" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Pricing</a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Twitter / X</a>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", width: "100%" }}>
          © {new Date().getFullYear()} Indyfren. Built for creators, by creators.
        </p>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <LiveTicker />
        <Problem />
        <AgentDemo />
        <HowItWorks />
        <SkillsGrid />
        <SocialProof />
        <Pricing />
        <FAQ />
        <FooterCTA />
      </main>
      <Footer />
    </>
  );
}
