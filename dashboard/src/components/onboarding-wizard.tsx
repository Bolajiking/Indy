"use client";

import { useState } from "react";
import { useAuth } from "@/lib/privy";
import {
  saveOnboardingContext,
  sendAgentMessage,
  type OnboardingContextInput,
} from "@/lib/api";

// ─── Design tokens (inline, consistent with existing pages) ──────────────────

const S = {
  card: {
    borderRadius: "var(--radius-hero)",
    border: "1px solid var(--border-default)",
    background: "var(--bg-canvas)",
    padding: 32,
  } as React.CSSProperties,
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-tertiary)",
  } as React.CSSProperties,
  input: {
    borderRadius: "var(--radius-input)",
    border: "1.5px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
  } as React.CSSProperties,
  primaryBtn: {
    background: "var(--accent-blue)",
    color: "white",
    borderRadius: "var(--radius-button)",
    padding: "10px 24px",
    fontSize: 13,
    fontWeight: 600,
  } as React.CSSProperties,
  ghostBtn: {
    border: "1.5px solid var(--border-light)",
    color: "var(--text-primary)",
    borderRadius: "var(--radius-button)",
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 500,
  } as React.CSSProperties,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 2,
            background:
              i < current
                ? "var(--accent-blue)"
                : i === current
                  ? "var(--accent-blue)"
                  : "var(--border-default)",
            opacity: i === current ? 1 : i < current ? 0.6 : 0.25,
            transition: "background 0.2s",
          }}
        />
      ))}
    </div>
  );
}

function ChipSelect({
  options,
  selected,
  onChange,
  multi = false,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (multi) {
                onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt]);
              } else {
                onChange(active ? [] : [opt]);
              }
            }}
            style={{
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 500,
              border: `1.5px solid ${active ? "var(--accent-blue)" : "var(--border-light)"}`,
              background: active ? "var(--accent-blue)" : "var(--bg-input)",
              color: active ? "white" : "var(--text-primary)",
              transition: "all 0.15s",
              cursor: "pointer",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Step data ────────────────────────────────────────────────────────────────

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Twitter / X", "LinkedIn", "Twitch", "Pinterest", "Snapchat"];
const NICHES = ["Fashion & Style", "Beauty", "Tech", "Gaming", "Finance", "Health & Fitness", "Food & Cooking", "Travel", "Parenting", "Education", "Entertainment", "Business"];
const FOLLOWER_RANGES = ["Under 1K", "1K – 10K", "10K – 50K", "50K – 250K", "250K – 1M", "1M+"];
const EXPERIENCE_LEVELS = [
  { value: "just_starting", label: "Just starting out", sub: "No brand deals yet" },
  { value: "some_deals", label: "Some experience", sub: "A few deals, learning the ropes" },
  { value: "active", label: "Actively working with brands", sub: "Multiple deals in flight" },
];
const GOALS = ["Find brand deals", "Negotiate better rates", "Review contracts", "Track revenue", "Manage my inbox", "Content strategy"];

// ─── Wizard state ─────────────────────────────────────────────────────────────

interface WizardData {
  displayName: string;
  niche: string;
  platforms: string[];
  followerRange: string;
  currentRateUsd: string;
  monthlyTargetUsd: string;
  experienceLevel: string;
  goals: string[];
}

// ─── Step components ──────────────────────────────────────────────────────────

function Step1Profile({
  data,
  onChange,
  onNext,
  syncing,
  error,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  syncing: boolean;
  error: string | null;
}) {
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>
        Step 1 of 3 · Profile
      </p>
      <h2
        style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}
      >
        Let&apos;s set up your profile
      </h2>
      <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
        Your name and niche help Indyfren find relevant brand deals and calculate accurate rates for you.
      </p>

      <div className="mt-8 space-y-5">
        <label className="block space-y-2">
          <span style={S.label}>Creator name or brand *</span>
          <input
            value={data.displayName}
            onChange={(e) => onChange({ displayName: e.target.value })}
            disabled={syncing}
            placeholder="e.g. Alex Chen, TechWithAlex"
            className="w-full px-4 py-3 text-sm outline-none transition focus:border-[var(--border-focus)]"
            style={S.input}
          />
        </label>

        <div className="space-y-2">
          <span style={S.label}>Your niche *</span>
          <div className="mt-2">
            <ChipSelect
              options={NICHES}
              selected={data.niche ? [data.niche] : []}
              onChange={(vals) => onChange({ niche: vals[0] ?? "" })}
            />
          </div>
          <input
            value={NICHES.includes(data.niche) ? "" : data.niche}
            onChange={(e) => onChange({ niche: e.target.value })}
            disabled={syncing}
            placeholder="Or type your own niche..."
            className="w-full px-4 py-3 text-sm outline-none transition mt-3"
            style={S.input}
          />
        </div>
      </div>

      {(localError ?? error) && (
        <p
          className="mt-4 px-4 py-3 text-sm"
          style={{
            borderRadius: "var(--radius-input)",
            border: "1px solid var(--accent-pink-border)",
            background: "var(--accent-pink-subtle)",
            color: "var(--text-primary)",
          }}
        >
          {localError ?? error}
        </p>
      )}

      <div className="mt-8">
        <button
          type="button"
          disabled={syncing}
          onClick={() => {
            setLocalError(null);
            if (!data.displayName.trim()) {
              setLocalError("Please enter your creator name.");
              return;
            }
            if (!data.niche.trim()) {
              setLocalError("Please select or enter your niche.");
              return;
            }
            onNext();
          }}
          className="transition hover:opacity-90 disabled:opacity-50"
          style={S.primaryBtn}
        >
          {syncing ? "Creating profile…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}

function Step2Audience({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>
        Step 2 of 3 · Audience
      </p>
      <h2
        style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}
      >
        Where&apos;s your audience?
      </h2>
      <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
        This helps Indyfren find brands that work with creators on your platforms and calculate your market rate.
      </p>

      <div className="mt-8 space-y-6">
        <div className="space-y-2">
          <span style={S.label}>Platforms you&apos;re active on *</span>
          <div className="mt-2">
            <ChipSelect
              options={PLATFORMS}
              selected={data.platforms}
              onChange={(vals) => onChange({ platforms: vals })}
              multi
            />
          </div>
        </div>

        <div className="space-y-2">
          <span style={S.label}>Approximate total follower count *</span>
          <div className="mt-2">
            <ChipSelect
              options={FOLLOWER_RANGES}
              selected={data.followerRange ? [data.followerRange] : []}
              onChange={(vals) => onChange({ followerRange: vals[0] ?? "" })}
            />
          </div>
        </div>

        <label className="block space-y-2">
          <span style={S.label}>Current rate per sponsored post (USD)</span>
          <div className="relative">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: "var(--text-tertiary)" }}
            >
              $
            </span>
            <input
              value={data.currentRateUsd}
              onChange={(e) => onChange({ currentRateUsd: e.target.value.replace(/[^0-9]/g, "") })}
              placeholder="e.g. 500"
              className="w-full pl-8 pr-4 py-3 text-sm outline-none transition"
              style={S.input}
            />
          </div>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Leave blank if you&apos;re not sure — Indyfren will calculate a recommended rate for you.
          </p>
        </label>
      </div>

      {localError && (
        <p
          className="mt-4 px-4 py-3 text-sm"
          style={{
            borderRadius: "var(--radius-input)",
            border: "1px solid var(--accent-pink-border)",
            background: "var(--accent-pink-subtle)",
            color: "var(--text-primary)",
          }}
        >
          {localError}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <button type="button" onClick={onBack} style={S.ghostBtn} className="transition hover:opacity-80">
          ← Back
        </button>
        <button
          type="button"
          onClick={() => {
            setLocalError(null);
            if (data.platforms.length === 0) {
              setLocalError("Select at least one platform.");
              return;
            }
            if (!data.followerRange) {
              setLocalError("Select your approximate follower count.");
              return;
            }
            onNext();
          }}
          className="transition hover:opacity-90"
          style={S.primaryBtn}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function Step3Business({
  data,
  onChange,
  onSubmit,
  onBack,
  syncing,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onSubmit: () => void;
  onBack: () => void;
  syncing: boolean;
}) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>
        Step 3 of 3 · Business
      </p>
      <h2
        style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}
      >
        Your creator business
      </h2>
      <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
        Help Indyfren understand where you are today so it can focus on what matters most.
      </p>

      <div className="mt-8 space-y-6">
        <div className="space-y-3">
          <span style={S.label}>Where are you with brand deals?</span>
          <div className="space-y-2 mt-2">
            {EXPERIENCE_LEVELS.map((lvl) => (
              <button
                key={lvl.value}
                type="button"
                onClick={() => onChange({ experienceLevel: lvl.value })}
                style={{
                  width: "100%",
                  textAlign: "left",
                  borderRadius: "var(--radius-card)",
                  border: `1.5px solid ${data.experienceLevel === lvl.value ? "var(--accent-blue)" : "var(--border-light)"}`,
                  background:
                    data.experienceLevel === lvl.value
                      ? "color-mix(in srgb, var(--accent-blue) 8%, var(--bg-canvas))"
                      : "var(--bg-input)",
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color:
                      data.experienceLevel === lvl.value
                        ? "var(--accent-blue)"
                        : "var(--text-primary)",
                  }}
                >
                  {lvl.label}
                </p>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {lvl.sub}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span style={S.label}>What should Indyfren focus on?</span>
          <div className="mt-2">
            <ChipSelect
              options={GOALS}
              selected={data.goals}
              onChange={(vals) => onChange({ goals: vals })}
              multi
            />
          </div>
        </div>

        <label className="block space-y-2">
          <span style={S.label}>Monthly income target from brand deals (USD)</span>
          <div className="relative">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: "var(--text-tertiary)" }}
            >
              $
            </span>
            <input
              value={data.monthlyTargetUsd}
              onChange={(e) =>
                onChange({ monthlyTargetUsd: e.target.value.replace(/[^0-9]/g, "") })
              }
              placeholder="e.g. 3000"
              className="w-full pl-8 pr-4 py-3 text-sm outline-none transition"
              style={S.input}
            />
          </div>
        </label>
      </div>

      <div className="mt-8 flex gap-3">
        <button type="button" onClick={onBack} style={S.ghostBtn} className="transition hover:opacity-80">
          ← Back
        </button>
        <button
          type="button"
          disabled={syncing}
          onClick={onSubmit}
          className="transition hover:opacity-90 disabled:opacity-50"
          style={S.primaryBtn}
        >
          {syncing ? "Saving…" : "Find my first opportunity →"}
        </button>
      </div>
    </div>
  );
}

function Step4FirstScan({
  agentReply,
  isScanning,
  onDone,
}: {
  agentReply: string | null;
  isScanning: boolean;
  onDone: () => void;
}) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>
        Almost done · First opportunity
      </p>
      <h2
        style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}
      >
        {isScanning ? "Scanning for opportunities…" : "Your first opportunity"}
      </h2>

      {isScanning ? (
        <div className="mt-8 space-y-3">
          <div
            style={{
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-input)",
              padding: 20,
            }}
          >
            {["Analysing your niche and platforms", "Scanning brand landscape", "Matching audience fit", "Calculating your market rate"].map(
              (label, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--accent-blue)",
                      opacity: 0.4 + i * 0.15,
                      animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite`,
                    }}
                  />
                  <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                    {label}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <div
            style={{
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-input)",
              padding: 20,
              whiteSpace: "pre-wrap",
              fontSize: 14,
              lineHeight: 1.8,
              color: "var(--text-primary)",
            }}
          >
            {agentReply ?? "Your workspace is ready. Head to the dashboard to get started."}
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={onDone}
              className="transition hover:opacity-90"
              style={S.primaryBtn}
            >
              Open my dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const { register, syncing, error, accessToken, refreshProfile, stage, creator } = useAuth();

  // If already registered (onboarding stage), start at step 2
  const initialStep = stage === "onboarding" ? 2 : 1;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep as 1 | 2 | 3 | 4);
  const [saving, setSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [agentReply, setAgentReply] = useState<string | null>(null);

  const [data, setData] = useState<WizardData>({
    displayName: creator?.display_name ?? "",
    niche: creator?.niche ?? "",
    platforms: [],
    followerRange: "",
    currentRateUsd: "",
    monthlyTargetUsd: "",
    experienceLevel: "",
    goals: [],
  });

  function patch(update: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...update }));
  }

  async function handleStep1Next() {
    await register({
      displayName: data.displayName.trim(),
      niche: data.niche.trim() || undefined,
    });
    setStep(2);
  }

  async function handleStep3Submit() {
    if (!accessToken) return;
    setSaving(true);
    try {
      const input: OnboardingContextInput = {
        platforms: data.platforms,
        followerRange: data.followerRange,
        goals: data.goals,
        experienceLevel: data.experienceLevel || "just_starting",
        ...(data.currentRateUsd ? { currentRateUsd: Number(data.currentRateUsd) } : {}),
        ...(data.monthlyTargetUsd ? { monthlyTargetUsd: Number(data.monthlyTargetUsd) } : {}),
      };
      await saveOnboardingContext(accessToken, input);
      setStep(4);
      await runFirstScan();
    } finally {
      setSaving(false);
    }
  }

  async function runFirstScan() {
    if (!accessToken) return;
    setIsScanning(true);
    try {
      const platformList = data.platforms.length > 0 ? data.platforms.join(", ") : "social media";
      const followerText = data.followerRange ? ` with ${data.followerRange} followers` : "";
      const goalText = data.goals.length > 0 ? ` My goals: ${data.goals.join(", ")}.` : "";
      const rateText = data.currentRateUsd
        ? ` I currently charge $${data.currentRateUsd} per post.`
        : "";
      const targetText = data.monthlyTargetUsd
        ? ` I want to earn $${data.monthlyTargetUsd}/month from brand deals.`
        : "";

      const prompt = `I just set up my Indyfren profile. I'm a ${data.niche || "content creator"} on ${platformList}${followerText}.${rateText}${targetText}${goalText} Can you scan for 2–3 brand deals that would be a great fit for me, and tell me what my recommended rate should be for a sponsored post?`;

      const response = await sendAgentMessage(accessToken, prompt);
      setAgentReply(response.reply.text);
    } catch {
      setAgentReply(
        "Your profile is all set! Head to your dashboard to scan for deals, check your rate card, and start managing your creator business."
      );
    } finally {
      setIsScanning(false);
    }
  }

  async function handleDone() {
    await refreshProfile();
  }

  return (
    <div style={S.card}>
      <StepIndicator current={step - 1} total={4} />

      {step === 1 && (
        <Step1Profile
          data={data}
          onChange={patch}
          onNext={() => void handleStep1Next()}
          syncing={syncing}
          error={error}
        />
      )}
      {step === 2 && (
        <Step2Audience
          data={data}
          onChange={patch}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <Step3Business
          data={data}
          onChange={patch}
          onSubmit={() => void handleStep3Submit()}
          onBack={() => setStep(2)}
          syncing={saving}
        />
      )}
      {step === 4 && (
        <Step4FirstScan
          agentReply={agentReply}
          isScanning={isScanning}
          onDone={() => void handleDone()}
        />
      )}
    </div>
  );
}
