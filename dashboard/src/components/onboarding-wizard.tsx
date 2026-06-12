"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import {
  saveOnboardingContext,
  sendAgentMessage,
  type OnboardingContextInput,
} from "@/lib/api";
import {
  BrandGlyph,
  Fren,
  Icon,
  Logo,
  LogoBadge,
  mdBold,
} from "@/components/cf/primitives";

const NICHES = [
  "Fashion & Style",
  "Beauty",
  "Tech",
  "Gaming",
  "Finance",
  "Health & Fitness",
  "Food & Cooking",
  "Travel",
  "Parenting",
  "Education",
  "Entertainment",
  "Business",
];
const PLATFORMS = [
  { name: "YouTube", glyph: true },
  { name: "Instagram", glyph: true },
  { name: "TikTok", glyph: true },
  { name: "X", glyph: true },
  { name: "LinkedIn", glyph: true },
  { name: "Twitch", glyph: true },
  { name: "Pinterest", glyph: true },
  { name: "Podcast", glyph: true },
];
const RANGES = [
  "Under 1K",
  "1K – 10K",
  "10K – 50K",
  "50K – 250K",
  "250K – 1M",
  "1M+",
];
const EXPERIENCE = [
  { k: "just_starting", t: "Just starting out", s: "No brand deals yet" },
  { k: "some_deals", t: "Some experience", s: "A few deals under my belt" },
  {
    k: "active",
    t: "Actively working with brands",
    s: "Multiple deals in flight",
  },
];
const GOALS = [
  "Find brand deals",
  "Negotiate better rates",
  "Review contracts",
  "Track revenue",
  "Manage inbox",
  "Content strategy",
];
const TOOLS = [
  { name: "YouTube", sub: "Audience & analytics", tag: "Recommended" },
  { name: "Gmail", sub: "Read & send brand emails" },
  { name: "Instagram", sub: "Audience & DMs" },
  { name: "Calendar", sub: "Deliverables & deadlines" },
  { name: "Stripe", sub: "Track revenue in/out" },
  { name: "Notion", sub: "Notes & media kit" },
];

const TOTAL = 6;
const SCAN_STEPS = [
  "Analysing your niche & platforms",
  "Scanning the brand landscape",
  "Matching audience fit",
  "Calculating your market rate",
];

function StepShell({
  step,
  onBack,
  children,
}: {
  step: number;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      {step > 0 && (
        <button
          className="icon-btn float-tl"
          onClick={onBack}
          aria-label="Back"
        >
          {Icon.back({ size: 20 })}
        </button>
      )}
      <div className="float-tr">
        <div className="pill-btn" style={{ paddingRight: 18 }}>
          <Logo size={15} />
        </div>
      </div>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          display: "grid",
          placeItems: "center",
          padding: 20,
        }}
      >
        <div
          className="glass rise"
          key={step}
          style={{ width: "min(460px, 94vw)", padding: "38px 34px 34px" }}
        >
          <div style={{ display: "flex", gap: 6, marginBottom: 30 }}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 99,
                  background:
                    i <= step
                      ? "var(--cf-secondary)"
                      : "rgb(var(--ink) / 0.12)",
                  transition: "background 0.4s var(--ease-out-expo)",
                }}
              />
            ))}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

export function OnboardingWizard() {
  const {
    register,
    updateProfile,
    syncing,
    error,
    accessToken,
    refreshProfile,
    creator,
  } = useAuth();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"form" | "scan" | "result">("form");
  const [scanActive, setScanActive] = useState(0);
  const [agentReply, setAgentReply] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(creator?.display_name ?? "");
  const [handle, setHandle] = useState("");
  const [niche, setNiche] = useState<string | null>(creator?.niche ?? null);
  const [plats, setPlats] = useState<string[]>([]);
  const [range, setRange] = useState<string | null>(null);
  const [rate, setRate] = useState("");
  const [exp, setExp] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>(["Find brand deals"]);
  const [tools, setTools] = useState<string[]>(["YouTube"]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  useEffect(() => {
    if (phase !== "scan") return;
    if (scanActive < SCAN_STEPS.length) {
      const t = setTimeout(() => setScanActive((a) => a + 1), 900);
      return () => clearTimeout(t);
    }
  }, [scanActive, phase]);

  async function finish() {
    setLocalError(null);
    setSaving(true);
    setPhase("scan");
    setScanActive(0);
    try {
      if (!creator) {
        await register({
          displayName: (name || "Creator").trim(),
          niche: niche ?? undefined,
        });
      } else if (niche && niche !== creator.niche) {
        await updateProfile({ niche });
      }

      const token = accessToken;
      if (token) {
        const input: OnboardingContextInput = {
          platforms: plats,
          followerRange: range ?? "",
          goals,
          experienceLevel: exp ?? "just_starting",
          ...(rate ? { currentRateUsd: Number(rate) } : {}),
        };
        await saveOnboardingContext(token, input);

        const platformList =
          plats.length > 0 ? plats.join(", ") : "social media";
        const followerText = range ? ` with ${range} followers` : "";
        const rateText = rate ? ` I currently charge $${rate} per post.` : "";
        const goalText =
          goals.length > 0 ? ` My goals: ${goals.join(", ")}.` : "";
        const prompt = `I just set up my Indyfren profile. I'm a ${niche ?? "content creator"} on ${platformList}${followerText}.${rateText}${goalText} Can you scan for 2–3 brand deals that would be a great fit for me, and tell me what my recommended rate should be for a sponsored post?`;

        const res = await sendAgentMessage(token, prompt);
        setAgentReply(res.reply.text);
      }
    } catch {
      setAgentReply(
        "Your profile is all set! Head to your dashboard to scan for deals, check your rate, and start managing your creator business.",
      );
    } finally {
      setScanActive(SCAN_STEPS.length);
      setSaving(false);
      setTimeout(() => setPhase("result"), 500);
    }
  }

  async function openDashboard() {
    await refreshProfile();
  }

  if (phase === "scan") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          display: "grid",
          placeItems: "center",
          padding: 20,
        }}
      >
        <div
          className="glass fade"
          style={{
            width: "min(440px,94vw)",
            padding: "44px 36px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "grid",
              placeItems: "center",
              marginBottom: 28,
              height: 110,
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 140,
                height: 140,
                borderRadius: 99,
                background:
                  "radial-gradient(closest-side, rgba(64,255,204,0.28), transparent)",
                animation: "pulseDot 1.8s infinite",
              }}
            />
            <Fren
              pose="scout"
              size={130}
              color="rgb(var(--ink))"
              colorB="var(--cf-secondary)"
              sw={19}
            />
          </div>
          <h1 className="h-title" style={{ marginBottom: 8 }}>
            Scanning for opportunities…
          </h1>
          <p className="h-sub" style={{ marginBottom: 30 }}>
            Indyfren is working. This is the part it does best.
          </p>
          <div style={{ display: "grid", gap: 14, textAlign: "left" }}>
            {SCAN_STEPS.map((s, i) => {
              const done = i < scanActive;
              const now = i === scanActive;
              return (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    opacity: i <= scanActive ? 1 : 0.35,
                    transition: "opacity 0.4s",
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 99,
                      flex: "none",
                      display: "grid",
                      placeItems: "center",
                      background: done
                        ? "var(--cf-grad-end)"
                        : "rgb(var(--ink) / 0.07)",
                      border: now ? "2px solid var(--cf-accent-blue)" : "none",
                    }}
                  >
                    {done ? (
                      Icon.check({ size: 14, color: "#06121a" })
                    ) : now ? (
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 99,
                          background: "var(--cf-accent-blue)",
                          animation: "pulseDot 1s infinite",
                        }}
                      />
                    ) : null}
                  </span>
                  <span
                    style={{
                      fontSize: 14.5,
                      fontWeight: 500,
                      color:
                        done || now
                          ? "rgb(var(--ink))"
                          : "rgb(var(--ink) / 0.6)",
                    }}
                  >
                    {s}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          display: "grid",
          placeItems: "center",
          padding: 20,
        }}
      >
        <div
          className="scroll-y"
          style={{
            width: "min(540px,94vw)",
            maxHeight: "92vh",
            padding: "2vh 0",
          }}
        >
          <div className="glass rise" style={{ padding: "34px 30px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <LogoBadge
                size={40}
                radius={13}
                bg="var(--cf-dark-blue)"
                color="#fff"
                colorB="var(--cf-accent-blue)"
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Indyfren</div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--cf-grad-end)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span className="live-dot" /> scan complete
                </div>
              </div>
            </div>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.55,
                margin: "0 0 18px",
                color: "rgb(var(--ink) / 0.95)",
              }}
            >
              here&apos;s your first opportunity, {name || "creator"} 👀
            </p>
            <div
              style={{
                background: "rgb(var(--ink) / 0.04)",
                border: "1px solid rgb(var(--ink) / 0.08)",
                borderRadius: 18,
                padding: "18px 20px",
                marginBottom: 22,
                fontSize: 14.5,
                lineHeight: 1.7,
                color: "rgb(var(--ink) / 0.85)",
                whiteSpace: "pre-wrap",
              }}
            >
              {agentReply
                ? mdBold(agentReply)
                : "Your workspace is ready. Head to the dashboard to get started."}
            </div>
            <button
              className="btn-primary btn-gradient"
              onClick={() => void openDashboard()}
              disabled={syncing}
            >
              {syncing ? "Opening…" : "Open my dashboard →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StepShell step={step} onBack={back}>
      {step === 0 && (
        <div>
          <h1 className="h-title" style={{ marginBottom: 6 }}>
            What should we call you?
          </h1>
          <p className="h-sub" style={{ marginBottom: 26 }}>
            This is how Indyfren and brands will know you.
          </p>
          <div className="field-group" style={{ marginBottom: 18 }}>
            <div className="field-row">
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="field-row">
              <label>Handle</label>
              <input
                value={handle}
                onChange={(e) =>
                  setHandle(
                    e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase(),
                  )
                }
                placeholder="handle"
              />
            </div>
          </div>
          <ul
            style={{
              margin: "0 0 28px",
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 9,
            }}
          >
            <li
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                fontSize: 13.5,
                color: "rgb(var(--ink) / 0.5)",
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 99,
                  background: "rgb(var(--ink) / 0.35)",
                }}
              />
              Brands &amp; agents find you at{" "}
              <b style={{ color: "rgb(var(--ink) / 0.82)", marginLeft: 2 }}>
                @{handle || "handle"}
              </b>
            </li>
            <li
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                fontSize: 13.5,
                color: "rgb(var(--ink) / 0.5)",
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 99,
                  background: "rgb(var(--ink) / 0.35)",
                }}
              />
              Your media kit lives at{" "}
              <b style={{ color: "rgb(var(--ink) / 0.82)", marginLeft: 2 }}>
                {handle || "handle"}.indyfren.com
              </b>
            </li>
          </ul>
          <button
            className="btn-primary"
            disabled={!name.trim()}
            onClick={next}
          >
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h1 className="h-title" style={{ marginBottom: 6 }}>
            What do you create?
          </h1>
          <p className="h-sub" style={{ marginBottom: 24 }}>
            So Indyfren scouts the right brands for you.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 9,
              marginBottom: 28,
            }}
          >
            {NICHES.map((n) => (
              <button
                key={n}
                className="chip"
                data-sel={niche === n}
                onClick={() => setNiche(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <button className="btn-primary" disabled={!niche} onClick={next}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 className="h-title" style={{ marginBottom: 6 }}>
            Where&apos;s your audience?
          </h1>
          <p className="h-sub" style={{ marginBottom: 22 }}>
            Pick every platform you post on.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 9,
              marginBottom: 22,
            }}
          >
            {PLATFORMS.map((p) => (
              <button
                key={p.name}
                className="chip"
                data-sel={plats.includes(p.name)}
                onClick={() => toggle(plats, setPlats, p.name)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  paddingLeft: p.glyph ? 8 : 16,
                }}
              >
                {p.glyph && <BrandGlyph name={p.name} size={22} />}
                {p.name}
              </button>
            ))}
          </div>
          <p className="eyebrow" style={{ margin: "0 0 12px" }}>
            Total following
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 9,
              marginBottom: 22,
            }}
          >
            {RANGES.map((r) => (
              <button
                key={r}
                className="chip"
                data-sel={range === r}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="eyebrow" style={{ margin: "0 0 10px" }}>
            Current rate / post (optional)
          </p>
          <div className="field-group" style={{ marginBottom: 28 }}>
            <div className="field-row">
              <label>$ per post</label>
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 500"
                inputMode="numeric"
              />
            </div>
          </div>
          <button
            className="btn-primary"
            disabled={!plats.length || !range}
            onClick={next}
          >
            Continue
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h1 className="h-title" style={{ marginBottom: 6 }}>
            How far along are you?
          </h1>
          <p className="h-sub" style={{ marginBottom: 22 }}>
            This sets the pace Indyfren works at.
          </p>
          <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
            {EXPERIENCE.map((e) => (
              <button
                key={e.k}
                className="opt"
                data-sel={exp === e.k}
                onClick={() => setExp(e.k)}
              >
                <span>
                  <span style={{ display: "block" }}>{e.t}</span>
                  <span className="opt-sub">{e.s}</span>
                </span>
                <span className="opt-check">{Icon.check({ size: 14 })}</span>
              </button>
            ))}
          </div>
          <p className="eyebrow" style={{ margin: "0 0 12px" }}>
            What should Indyfren focus on?
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 9,
              marginBottom: 28,
            }}
          >
            {GOALS.map((g) => (
              <button
                key={g}
                className="chip"
                data-sel={goals.includes(g)}
                onClick={() => toggle(goals, setGoals, g)}
              >
                {g}
              </button>
            ))}
          </div>
          <button className="btn-primary" disabled={!exp} onClick={next}>
            Continue
          </button>
        </div>
      )}

      {step === 4 && (
        <div>
          <h1 className="h-title" style={{ marginBottom: 6 }}>
            Connect your world
          </h1>
          <p className="h-sub" style={{ marginBottom: 22 }}>
            The more Indyfren can see, the more it can do for you. You&apos;re
            always in control.
          </p>
          <div
            className="field-group"
            style={{ marginBottom: 22, background: "rgb(var(--ink) / 0.03)" }}
          >
            {TOOLS.map((t) => {
              const on = tools.includes(t.name);
              return (
                <div
                  key={t.name}
                  className="field-row"
                  style={{ padding: "14px 16px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 13,
                      minWidth: 0,
                    }}
                  >
                    <BrandGlyph name={t.name} size={38} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 15 }}>
                          {t.name}
                        </span>
                        {t.tag && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              color: "#40ffcc",
                              background: "rgba(64,255,204,0.12)",
                              padding: "3px 7px",
                              borderRadius: 99,
                            }}
                          >
                            {t.tag}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "rgb(var(--ink) / 0.45)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {t.sub}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(tools, setTools, t.name)}
                    style={{
                      flex: "none",
                      width: 34,
                      height: 34,
                      borderRadius: 99,
                      display: "grid",
                      placeItems: "center",
                      border: "none",
                      background: on
                        ? "var(--cf-secondary)"
                        : "rgb(var(--ink) / 0.07)",
                      color: "#fff",
                      transition: "all 0.2s var(--ease-out-expo)",
                    }}
                  >
                    {on ? Icon.check({ size: 16 }) : Icon.plus({ size: 16 })}
                  </button>
                </div>
              );
            })}
          </div>
          <button className="btn-primary" onClick={next}>
            Continue
          </button>
          <button
            className="btn-ghost"
            style={{ marginTop: 10, height: 48 }}
            onClick={next}
          >
            Skip for now
          </button>
          <p
            style={{
              textAlign: "center",
              fontSize: 12.5,
              color: "rgb(var(--ink) / 0.4)",
              margin: "16px 0 0",
            }}
          >
            You can connect more later from Settings.
          </p>
        </div>
      )}

      {step === 5 && (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "grid",
              placeItems: "center",
              marginBottom: 18,
              height: 96,
            }}
          >
            <Fren
              pose="reach"
              size={104}
              color="rgb(var(--ink))"
              colorB="var(--cf-secondary)"
              sw={20}
            />
          </div>
          <h1 className="h-title" style={{ marginBottom: 8 }}>
            You&apos;re all set, {name || "creator"}.
          </h1>
          <p className="h-sub" style={{ maxWidth: 320, margin: "0 auto 28px" }}>
            Indyfren is ready to scan{" "}
            {niche ? niche.toLowerCase() : "your niche"} brands and find your
            first opportunity.
          </p>
          {(localError ?? error) && (
            <p
              style={{
                fontSize: 13,
                color: "var(--cf-coral)",
                marginBottom: 14,
              }}
            >
              {localError ?? error}
            </p>
          )}
          <button
            className="btn-primary btn-gradient"
            onClick={() => void finish()}
            disabled={saving || syncing}
          >
            {saving || syncing ? "Setting up…" : "Find my first opportunity →"}
          </button>
        </div>
      )}
    </StepShell>
  );
}
