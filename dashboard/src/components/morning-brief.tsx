"use client";

export interface BriefItem {
  emoji: string;
  title: string;
  detail: string;
  actionPrompt: string;
}

export interface MorningBriefData {
  greeting: string;
  items: BriefItem[];
  closingNote: string;
}

export function MorningBriefCard({ brief }: { brief: MorningBriefData }) {
  return (
    <article
      className="p-6"
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-surface)'
      }}
    >
      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Morning brief</p>
      <p className="mt-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{brief.greeting}</p>

      <div className="mt-5 space-y-4">
        {brief.items.map((item, i) => (
          <div
            key={i}
            className="p-4"
            style={{
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)'
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{item.emoji}</span>
              <div>
                <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                <p className="mt-1 text-sm leading-7" style={{ color: 'var(--text-tertiary)' }}>{item.detail}</p>
                <p className="mt-2 text-sm italic" style={{ color: 'var(--accent-pink)' }}>
                  {item.actionPrompt}
                </p>
              </div>
            </div>
          </div>
        ))}

        {brief.items.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No items in today&apos;s brief. Check back tomorrow morning.
          </p>
        )}
      </div>

      <p className="mt-5 text-sm leading-7" style={{ color: 'var(--text-tertiary)' }}>{brief.closingNote}</p>
    </article>
  );
}
