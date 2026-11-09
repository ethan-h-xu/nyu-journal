const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Formats a YYYY-MM-DD date in the local time zone, so it doesn't shift a day. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}

/** Newest visit first; entries from the same day put the most recently written first. */
export function compareNewestFirst(
  a: { date: string; createdAt: number },
  b: { date: string; createdAt: number },
): number {
  return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
}

/** Today's date in the local time zone, as YYYY-MM-DD. */
export function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** The local date `days` before today, as YYYY-MM-DD. */
export function daysAgo(days: number): string {
  const [year, month, day] = today().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - days));
  return date.toISOString().slice(0, 10);
}
