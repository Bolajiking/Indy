"use client";

import { useEffect, useState } from "react";

import { getProfileSaveErrorCopy } from "@/lib/onboarding-errors";
import { useAuth } from "@/lib/privy";

export function ProfileSettingsForm() {
  const { creator, onboarding, syncing, error, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [niche, setNiche] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const surfacedError = localError ?? getProfileSaveErrorCopy(error);

  useEffect(() => {
    setDisplayName(creator?.display_name ?? "");
    setNiche(creator?.niche ?? "");
  }, [creator?.display_name, creator?.niche]);

  if (!creator) {
    return null;
  }

  return (
    <article
      className="p-6"
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-canvas)'
      }}
    >
      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Your profile</p>
      <h3 className="mt-2 text-3xl" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Creator details</h3>

      <form
        className="mt-6 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSavedMessage(null);
          setLocalError(null);

          if (!displayName.trim()) {
            setLocalError("Add a creator display name before saving.");
            return;
          }

          void updateProfile({
            displayName: displayName.trim(),
            niche: niche.trim() || undefined,
          })
            .then(() => {
              setSavedMessage("Profile saved.");
            })
            .catch(() => {
              // Context stores the canonical error.
            });
        }}
      >
        <label className="space-y-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
            Display name
          </span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={syncing}
            className="w-full px-4 py-3 text-sm outline-none transition"
            style={{
              borderRadius: '18px',
              border: '1.5px solid var(--border-light)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-focus)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
            Niche
          </span>
          <input
            value={niche}
            onChange={(event) => setNiche(event.target.value)}
            disabled={syncing}
            className="w-full px-4 py-3 text-sm outline-none transition"
            style={{
              borderRadius: '18px',
              border: '1.5px solid var(--border-light)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-focus)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
          />
        </label>

        <div className="md:col-span-2 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={syncing}
            className="rounded-full px-6 py-3 text-xs font-semibold transition disabled:opacity-50 hover:opacity-90"
            style={{
              background: 'var(--accent-blue)',
              color: 'white'
            }}
          >
            {syncing ? "Saving..." : "Save profile"}
          </button>
          <div
            className="rounded-full px-4 py-3 text-xs font-semibold"
            style={{
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              color: 'var(--text-tertiary)'
            }}
          >
            {onboarding.status === "active" ? "Wallet ready" : "Wallet setting up"}
          </div>
        </div>
      </form>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div
          className="p-4"
          style={{
            borderRadius: '18px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-surface)'
          }}
        >
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Creator ID</p>
          <p className="mt-2 break-all text-sm" style={{ color: 'var(--text-primary)' }}>{creator.id}</p>
        </div>
        <div
          className="p-4"
          style={{
            borderRadius: '18px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-surface)'
          }}
        >
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Wallet status</p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            {creator.wallet_address
              ? `Active at ${creator.wallet_address}`
              : "Your wallet is still being set up."}
          </p>
        </div>
      </div>

      {savedMessage || surfacedError ? (
        <p
          className="mt-4 px-4 py-3 text-sm"
          style={{
            borderRadius: '18px',
            border: '1px solid var(--border-default)',
            background: 'white',
            color: 'var(--text-primary)'
          }}
        >
          {surfacedError ?? savedMessage}
        </p>
      ) : null}
    </article>
  );
}
