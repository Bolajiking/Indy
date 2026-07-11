"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardDeal, DashboardDealMutationInput } from "@/lib/api";

export function DealForm({
  deal,
  busy,
  serverError,
  serverFieldErrors,
  onCancel,
  onSubmit,
}: {
  deal?: DashboardDeal | null;
  busy?: boolean;
  serverError?: string | null;
  serverFieldErrors?: Record<string, string[]>;
  onCancel: () => void;
  onSubmit: (
    input: DashboardDealMutationInput & { brandName?: string },
  ) => void;
}) {
  const [brandName, setBrandName] = useState(deal?.brand_name ?? "");
  const [email, setEmail] = useState(deal?.brand_contact_email ?? "");
  const [contactName, setContactName] = useState(
    deal?.brand_contact_name ?? "",
  );
  const [value, setValue] = useState(
    deal?.estimated_value_cents != null
      ? String(deal.estimated_value_cents / 100)
      : "",
  );
  const [deadline, setDeadline] = useState(
    deal?.deadline_at?.slice(0, 10) ?? "",
  );
  const [notes, setNotes] = useState(deal?.notes ?? "");
  const [fitScore, setFitScore] = useState(
    deal?.fit_score == null ? "" : String(deal.fit_score),
  );
  const [probability, setProbability] = useState(
    deal?.probability == null ? "" : String(deal.probability),
  );
  const [nextAction, setNextAction] = useState(deal?.next_action ?? "");
  const [followUp, setFollowUp] = useState(
    deal?.follow_up_at?.slice(0, 10) ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onCancel]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!brandName.trim()) next.brandName = "Brand name is required";
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      next.brandContactEmail = "Enter a valid email";
    const dollars = value === "" ? null : Number(value);
    if (dollars != null && (!Number.isFinite(dollars) || dollars < 0)) {
      next.estimatedValueCents = "Enter a non-negative value";
    }
    for (const [field, raw] of [
      ["fitScore", fitScore],
      ["probability", probability],
    ] as const) {
      const number = raw === "" ? null : Number(raw);
      if (
        number != null &&
        (!Number.isInteger(number) || number < 0 || number > 100)
      ) {
        next[field] = "Enter a whole number from 0 to 100";
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      ...(!deal
        ? { brandName: brandName.trim() }
        : { brandName: brandName.trim() }),
      brandContactEmail: email.trim() || null,
      brandContactName: contactName.trim() || null,
      estimatedValueCents: dollars == null ? null : Math.round(dollars * 100),
      deadlineAt: deadline
        ? new Date(`${deadline}T00:00:00.000Z`).toISOString()
        : null,
      notes: notes.trim() || null,
      fitScore: fitScore === "" ? null : Number(fitScore),
      probability: probability === "" ? null : Number(probability),
      nextAction: nextAction.trim() || null,
      followUpAt: followUp
        ? new Date(`${followUp}T00:00:00.000Z`).toISOString()
        : null,
    });
  }

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={onCancel}>
      <div
        className="gcard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-form-title"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ width: "min(560px, 92vw)", padding: 24 }}
      >
        <h2 id="deal-form-title">{deal ? "Edit deal" : "Add deal"}</h2>
        <form onSubmit={submit} noValidate style={{ display: "grid", gap: 14 }}>
          <label>
            Brand name
            <input
              ref={first}
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              aria-invalid={!!errors.brandName}
            />
          </label>
          {errors.brandName && <span role="alert">{errors.brandName}</span>}
          <label>
            Contact email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.brandContactEmail}
            />
          </label>
          {errors.brandContactEmail && (
            <span role="alert">{errors.brandContactEmail}</span>
          )}
          {serverFieldErrors?.brandContactEmail?.map((message) => (
            <span role="alert" key={message}>
              {message}
            </span>
          ))}
          <label>
            Contact name
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </label>
          <label>
            Estimated value (USD)
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label>
            Fit score
            <input
              type="number"
              min="0"
              max="100"
              value={fitScore}
              onChange={(e) => setFitScore(e.target.value)}
            />
          </label>
          <label>
            Probability
            <input
              type="number"
              min="0"
              max="100"
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
            />
          </label>
          <label>
            Next action
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
          </label>
          <label>
            Follow up
            <input
              type="date"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
            />
          </label>
          <label>
            Deadline
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <label>
            Notes
            <textarea
              maxLength={10000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {serverError && (
            <p role="alert" style={{ color: "var(--cf-coral)" }}>
              {serverError}
            </p>
          )}
          {serverFieldErrors?.brandName?.map((message) => (
            <p role="alert" key={message}>
              {message}
            </p>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="dark-pill" onClick={onCancel}>
              Cancel
            </button>
            <button className="dark-pill dark-pill--solid" disabled={busy}>
              {busy ? "Saving…" : "Save deal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
