import { formatCurrency, type DashboardDeal } from "@/lib/api";

export function DealCard({ deal }: { deal: DashboardDeal }) {
  return (
    <div
      className="p-4"
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-surface)'
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{deal.brand_name}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {deal.stage}
          </p>
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--accent-pink)' }}>
          {formatCurrency(deal.estimated_value_cents ?? 0)}
        </p>
      </div>
      <p className="mt-3 text-sm leading-7 text-ink/78">
        Fit score {deal.fit_score ?? "n/a"}
        {deal.notes ? ` • ${deal.notes}` : ""}
      </p>
    </div>
  );
}
