import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10 md:py-12" style={{ background: "var(--bg-canvas)" }}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-between p-6 md:p-10"
        style={{ borderRadius: "var(--radius-hero)", border: "1px solid var(--border-default)" }}
      >
        <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
          <section className="grid gap-10 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-12">
            <div className="space-y-8">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>Creator Operations Console</p>
              <div className="space-y-6">
                <h1
                  className="max-w-3xl text-5xl leading-[0.95] tracking-tight md:text-7xl"
                  style={{ fontWeight: 700, color: "var(--text-primary)" }}
                >
                  A deal desk for creators who treat their audience like a business.
                </h1>
                <p className="max-w-2xl text-lg leading-8" style={{ color: "var(--text-tertiary)" }}>
                  Indyfren turns chat conversations into a living pipeline: morning briefs,
                  sponsor scouting, deal stages, wallet activity, and the next best move for
                  today&apos;s revenue.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/dashboard"
                  className="text-sm font-semibold text-white transition hover:opacity-90"
                  style={{
                    background: "var(--accent-blue)",
                    borderRadius: "var(--radius-button)",
                    padding: "12px 24px",
                  }}
                >
                  Open Dashboard
                </Link>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium transition hover:opacity-80"
                  style={{
                    border: "1.5px solid var(--border-light)",
                    borderRadius: "var(--radius-button)",
                    padding: "12px 24px",
                    color: "var(--text-primary)",
                  }}
                >
                  Connect Telegram
                </Link>
              </div>
            </div>

            <div className="grid gap-4 self-start">
              <div className="p-6" style={{ borderRadius: "var(--radius-card)", background: "var(--gradient-approval)", color: "white" }}>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Today&apos;s brief</p>
                <p className="mt-4 text-3xl leading-tight" style={{ fontWeight: 700 }}>
                  3 sponsor fits surfaced before breakfast.
                </p>
                <p className="mt-4 text-sm leading-7" style={{ color: "rgba(255,255,255,0.72)" }}>
                  Two finance tools are warm, one pitch is waiting for approval, and wallet
                  spend is still inside policy.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5" style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>AI-powered</p>
                  <p className="mt-3 text-lg font-semibold" style={{ color: "var(--accent-green-text)" }}>Deal scanning, pitching, and rate negotiation</p>
                </div>
                <div className="p-5" style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-canvas)" }}>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Your wallet</p>
                  <p className="mt-3 text-lg font-semibold" style={{ color: "var(--accent-pink)" }}>$10 free credits to get started</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
