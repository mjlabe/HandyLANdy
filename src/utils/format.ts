export function formatTemperature(value?: number): string {
  return value === undefined || !Number.isFinite(value) ? '—' : `${Math.round(value)}°`;
}

export function formatDuration(minutes?: number): string {
  if (minutes === undefined || !Number.isFinite(minutes)) return '—';
  const value = Math.max(0, Math.round(minutes));
  return value < 60 ? `${value} min` : `${Math.floor(value / 60)}h ${value % 60}m`;
}

export function isStatusStale(lastReportAt: number | undefined, now: number): boolean {
  return lastReportAt === undefined || now - lastReportAt >= 30_000;
}
