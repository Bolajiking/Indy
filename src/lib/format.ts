/** Format a cent amount as exact dollars, e.g. 1234 -> "$12.34". */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Format a cent amount as whole dollars, e.g. 123456 -> "$1235". */
export function formatUsdWhole(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}
