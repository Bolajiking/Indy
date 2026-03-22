import { formatCurrency, type DashboardTransaction } from "@/lib/api";

export function WalletBalance({
  transactions,
}: {
  transactions: DashboardTransaction[];
}) {
  const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount_cents, 0);

  return (
    <article
      className="p-6"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--accent-blue-bg)',
        border: '1px solid var(--accent-blue-border)'
      }}
    >
      <p className="text-[11px]" style={{ color: 'rgba(255, 255, 255, 0.55)' }}>Total agent spend</p>
      <p className="mt-4 text-5xl font-semibold" style={{ color: 'white' }}>{formatCurrency(totalSpent)}</p>
      <p className="mt-4 text-sm leading-7" style={{ color: 'rgba(255, 255, 255, 0.72)' }}>
        {transactions.length === 0
          ? "No wallet activity yet."
          : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"} recorded.`}
      </p>
    </article>
  );
}
