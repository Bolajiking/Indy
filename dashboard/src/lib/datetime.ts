const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function toUtcDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatDashboardDate(value: string | Date) {
  const date = toUtcDate(value);
  if (!date) {
    return "Invalid date";
  }

  return `${pad(date.getUTCDate())} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatDashboardTime(value: string | Date) {
  const date = toUtcDate(value);
  if (!date) {
    return "Invalid time";
  }

  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function formatDashboardDateTime(value: string | Date) {
  const date = toUtcDate(value);
  if (!date) {
    return "Invalid date";
  }

  return `${formatDashboardDate(date)}, ${formatDashboardTime(date)}`;
}

export function formatDashboardNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const [whole, fraction] = value.toString().split(".");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${groupedWhole}.${fraction}` : groupedWhole;
}
