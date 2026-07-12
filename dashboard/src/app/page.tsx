import Link from "next/link";

import {
  Ambient,
  BrandGlyph,
  Logo,
  LogoBadge,
} from "@/components/cf/primitives";
import { LandingComposer } from "@/components/landing-composer";
import { LegalFooter } from "@/components/legal-footer";

const LIVE_CARDS = [
  {
    label: "Example · Brand match",
    title: "Sample pitch to Glow Labs",
    detail: "Example $3,200 deal · 94% fit",
    accent: "var(--cf-grad-end)",
  },
  {
    label: "Example · Contract review",
    title: "2 red flags found",
    detail: "Exclusivity + late-payment clause",
    accent: "var(--cf-coral)",
  },
  {
    label: "Example · Morning brief",
    title: "3 new brand fits discovered",
    detail: "Beauty, wellness, tech — ready to pitch",
    accent: "var(--cf-accent-blue)",
  },
  {
    label: "Revenue update",
    title: "Invoice paid · $1,850",
    detail: "Cleared to your wallet",
    accent: "var(--cf-periwinkle)",
  },
];

const STEPS = [
  {
    n: "01",
    t: "Tell Indyfren your niche & goals",
    d: "A 30-second setup. Your agent learns your audience, rates, and the brands you want.",
  },
  {
    n: "02",
    t: "Your agent works, 24/7",
    d: "It scouts deals, drafts pitches, reviews contracts, and briefs you every morning.",
  },
  {
    n: "03",
    t: "You approve. It runs.",
    d: "Approve what you want, skip the rest. Indyfren handles execution — including payment.",
  },
];

const SKILLS = [
  "Brand Deal Scanner",
  "Rate Calculator",
  "Pitch Generator",
  "Contract Reviewer",
  "Revenue Advisor",
  "Financial Tracker",
  "Morning Brief",
  "Analytics Aggregator",
  "Content Strategy",
  "Inbox Triager",
  "Calendar Manager",
  "SEO Optimizer",
];

function Nav() {
  return (
    <div className="topnav" style={{ position: "absolute" }}>
      <div className="pill-btn" style={{ paddingRight: 16 }}>
        <Logo size={16} />
      </div>
      <div className="nav-actions">
        <Link className="pill-btn" href="/dashboard?login=1">
          Sign in
        </Link>
        <Link
          className="dark-pill dark-pill--solid"
          style={{ height: 46, whiteSpace: "nowrap" }}
          href="/dashboard?login=1"
        >
          Get started free
        </Link>
      </div>
    </div>
  );
}

function LiveCards() {
  const cards = LIVE_CARDS.slice(0, 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {cards.map((c, i) => (
        <div
          key={c.title + i}
          className="gcard fade"
          style={{
            padding: "16px 18px",
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: c.accent,
              marginTop: 6,
              flex: "none",
            }}
          />
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: c.accent,
                marginBottom: 3,
              }}
            >
              {c.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{c.title}</div>
            <div
              style={{
                fontSize: 12.5,
                color: "rgb(var(--ink) / 0.5)",
                marginTop: 2,
              }}
            >
              {c.detail}
            </div>
          </div>
        </div>
      ))}
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}
      >
        <span className="live-dot" />
        <span
          style={{
            fontSize: 12,
            color: "rgb(var(--ink) / 0.5)",
            fontWeight: 500,
          }}
        >
          Example workflow preview
        </span>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <Ambient />
      <Nav />
      <div
        className="app-content scroll-y"
        style={{ position: "relative", zIndex: 1 }}
      >
        {/* HERO */}
        <section
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "clamp(110px, 16vh, 150px) 24px 80px",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 48,
              gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)",
              alignItems: "start",
            }}
            className="hero-grid"
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  padding: "6px 14px",
                  borderRadius: 99,
                  border: "1px solid var(--cf-accent-blue)",
                  color: "var(--cf-accent-blue)",
                  background: "rgba(64,172,255,0.1)",
                  marginBottom: 24,
                }}
              >
                The AI agent for independent creators
              </div>
              <h1
                style={{
                  fontSize: "clamp(40px, 6vw, 64px)",
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.02,
                  margin: "0 0 20px",
                  color: "rgb(var(--ink))",
                }}
              >
                Finally, an AI that{" "}
                <span
                  style={{
                    background: "var(--cf-cta-gradient)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  works your deals.
                </span>
              </h1>
              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.6,
                  color: "rgb(var(--ink) / 0.6)",
                  maxWidth: 480,
                  margin: "0 0 28px",
                }}
              >
                Indyfren scouts sponsors, writes pitches, reviews contracts, and
                tracks your revenue — 24/7, while you focus on creating.
              </p>
              <LandingComposer />
            </div>
            <div style={{ paddingTop: 8 }} className="hero-cards">
              <LiveCards />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px" }}
        >
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            How it works
          </div>
          <h2
            style={{
              fontSize: "clamp(28px,4vw,40px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: "0 0 36px",
              color: "rgb(var(--ink))",
            }}
          >
            From setup to signed deals in 3 steps.
          </h2>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            {STEPS.map((s) => (
              <div key={s.n} className="gcard" style={{ padding: 26 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--cf-accent-blue)",
                    background: "rgba(64,172,255,0.12)",
                    borderRadius: 99,
                    padding: "4px 12px",
                  }}
                >
                  {s.n}
                </span>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    margin: "16px 0 10px",
                  }}
                >
                  {s.t}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "rgb(var(--ink) / 0.55)",
                    margin: 0,
                  }}
                >
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SKILLS */}
        <section
          style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px" }}
        >
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            12 specialized skills
          </div>
          <h2
            style={{
              fontSize: "clamp(28px,4vw,40px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: "0 0 8px",
              color: "rgb(var(--ink))",
            }}
          >
            One agent. Every job your team would do.
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "rgb(var(--ink) / 0.55)",
              maxWidth: 520,
              margin: "0 0 32px",
            }}
          >
            Each skill is a specialized capability. Together, they run your
            entire creator business.
          </p>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            }}
          >
            {SKILLS.map((s) => (
              <div
                key={s}
                className="gcard"
                style={{
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    background: "var(--cf-grad-end)",
                    flex: "none",
                  }}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "40px 24px 100px",
          }}
        >
          <div
            className="glass"
            style={{
              padding: "48px 32px",
              textAlign: "center",
              borderRadius: 32,
            }}
          >
            <div
              style={{
                display: "grid",
                placeItems: "center",
                marginBottom: 18,
              }}
            >
              <LogoBadge
                size={56}
                radius={18}
                bg="var(--cf-dark-blue)"
                color="#fff"
                colorB="var(--cf-accent-blue)"
              />
            </div>
            <h2
              style={{
                fontSize: "clamp(28px,4vw,42px)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "0 0 14px",
                color: "rgb(var(--ink))",
              }}
            >
              Every deal, pitch, and dollar — handled while you create.
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "rgb(var(--ink) / 0.6)",
                margin: "0 0 28px",
              }}
            >
              Free to start. No credit card. $10 in credits on signup.
            </p>
            <Link
              className="btn-primary btn-gradient"
              style={{ width: "auto", padding: "0 32px", margin: "0 auto" }}
              href="/dashboard?login=1"
            >
              Get started free →
            </Link>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 40,
              color: "rgb(var(--ink) / 0.5)",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Logo size={14} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Instagram", "YouTube", "TikTok", "X"].map((p) => (
                <BrandGlyph key={p} name={p} size={26} />
              ))}
            </div>
            <span>
              © {new Date().getFullYear()} Indyfren · Built for creators, by
              creators.
            </span>
          </div>
        </section>
      </div>

      <LegalFooter />

      <style>{`
        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-cards { display: none; }
        }
      `}</style>
    </>
  );
}
