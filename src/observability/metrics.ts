type Labels = Record<string, string | number | boolean>;
const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const durations = new Map<string, { count: number; totalMs: number }>();

function key(name: string, labels: Labels = {}): string {
  const bounded = Object.entries(labels)
    .filter(([label]) => !/(creator|user|request|email|address)/i.test(label))
    .sort(([a], [b]) => a.localeCompare(b));
  return `${name}{${bounded.map(([k, v]) => `${k}=${String(v).slice(0, 80)}`).join(",")}}`;
}

export function incrementMetric(
  name: string,
  labels?: Labels,
  amount = 1,
): void {
  const metric = key(name, labels);
  counters.set(metric, (counters.get(metric) ?? 0) + amount);
}

export function observeDuration(
  name: string,
  durationMs: number,
  labels?: Labels,
): void {
  const metric = key(name, labels);
  const current = durations.get(metric) ?? { count: 0, totalMs: 0 };
  durations.set(metric, {
    count: current.count + 1,
    totalMs: current.totalMs + durationMs,
  });
}

export function setMetric(name: string, value: number, labels?: Labels): void {
  gauges.set(key(name, labels), value);
}

export function metricSnapshot() {
  return {
    counters: Object.fromEntries(counters),
    durations: Object.fromEntries(durations),
    gauges: Object.fromEntries(gauges),
  };
}
