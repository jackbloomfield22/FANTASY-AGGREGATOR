/**
 * Where a signed-in user lands. On NFL game days during the season the
 * answer is the live window; otherwise the dashboard. Evaluated in Eastern
 * Time so "Sunday" means NFL Sunday wherever the user is.
 */

const ET_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "numeric",
  day: "numeric",
});

export function isGameDay(now: Date = new Date()): boolean {
  const parts = ET_DAY.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  const month = Number(get("month"));
  const day = Number(get("day"));
  const gameDay = weekday === "Thu" || weekday === "Sun" || weekday === "Mon";
  // Regular season + playoffs: September through mid-February.
  const inSeason = month >= 9 || month === 1 || (month === 2 && day <= 15);
  return gameDay && inSeason;
}

export function defaultLandingPath(now: Date = new Date()): "/live" | "/dashboard" {
  return isGameDay(now) ? "/live" : "/dashboard";
}
