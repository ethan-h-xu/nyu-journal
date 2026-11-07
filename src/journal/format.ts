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
