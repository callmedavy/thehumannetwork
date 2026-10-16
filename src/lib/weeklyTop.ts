/**
 * Calendar weeks for the Weekly Top 10 chart.
 *
 * A week runs Sunday 00:00 to Saturday 23:59:59.999 in the reader's own timezone, which is the
 * only reading that makes the label honest: "October 4-10, 2026" has to mean the same seven days
 * to the person clicking it as it does to the clock. Windows are half-open (`start` inclusive,
 * `end` exclusive) so no post can belong to two weeks at once.
 *
 * Nothing here talks to the network. The transport in `lib/lemmy.ts` pages the instance and
 * filters to the window this module hands it; the picker in `WeeklyTopView.tsx` never issues a
 * request at all.
 */

export interface WeekWindow {
  /** Sunday 00:00 local time, inclusive. */
  start: Date;
  /** The next Sunday 00:00 local time, exclusive. */
  end: Date;
  /** `YYYY-MM-DD` of the Sunday. React key, and stable enough to compare two windows by. */
  key: string;
}

/** How many posts the chart shows. Ten, because it says ten. */
export const WEEKLY_TOP_SIZE = 10;

/**
 * How many finished weeks the picker offers. Each one costs at least one request to open and up
 * to `WEEKLY_TOP_MAX_PAGES` for the older ones, so the list is deliberately a quarter rather
 * than all of history.
 */
export const WEEKLY_TOP_WEEKS_OFFERED = 12;

export function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  // `getDay()` is 0 on Sunday, so this walks back to the Sunday that opens the current week.
  start.setDate(start.getDate() - start.getDay());
  return start;
}

/** Local-time date key. Deliberately not `toISOString()`, which would shift to UTC and name the
 * wrong day either side of midnight. */
export function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function weekWindow(sunday: Date): WeekWindow {
  const start = startOfWeek(sunday);
  // `setDate` rather than `+ 7 * 86_400_000`: a week containing a DST change is 167 or 169 hours,
  // and adding a fixed number of milliseconds would put `end` an hour off the true Sunday.
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end, key: toDateKey(start) };
}

export function isWithinWeek(published: string, week: WeekWindow) {
  const time = new Date(published).getTime();
  return time >= week.start.getTime() && time < week.end.getTime();
}

/**
 * Finished weeks, newest first. The week containing `now` is excluded: it is still being voted
 * on, so a chart of it would be a different chart every time the reader looked.
 */
export function completedWeeks(count = WEEKLY_TOP_WEEKS_OFFERED, now = new Date()): WeekWindow[] {
  const weeks: WeekWindow[] = [];
  let sunday = startOfWeek(now);
  for (let index = 0; index < count; index += 1) {
    sunday = new Date(sunday);
    sunday.setDate(sunday.getDate() - 7);
    weeks.push(weekWindow(sunday));
  }
  return weeks;
}

/**
 * "October 4-10, 2026" — and the two longer shapes a week needs when it straddles a month
 * ("September 27-October 3, 2026") or a year ("December 27, 2026-January 2, 2027"), where
 * repeating the month or the year would be the only way to stay unambiguous.
 */
export function formatWeekLabel({ start, end }: WeekWindow) {
  const last = new Date(end);
  last.setDate(last.getDate() - 1); // the Saturday
  const month = (date: Date) => date.toLocaleDateString("en-US", { month: "long" });

  if (start.getFullYear() !== last.getFullYear()) {
    return `${month(start)} ${start.getDate()}, ${start.getFullYear()}-${month(last)} ${last.getDate()}, ${last.getFullYear()}`;
  }
  if (start.getMonth() !== last.getMonth()) {
    return `${month(start)} ${start.getDate()}-${month(last)} ${last.getDate()}, ${start.getFullYear()}`;
  }
  return `${month(start)} ${start.getDate()}-${last.getDate()}, ${start.getFullYear()}`;
}

/**
 * Which Lemmy top-sort window to page in order to fill in one week.
 *
 * Lemmy v3 has no absolute date filter: no `from`/`to`, and the `TopWeek` sort means *the seven
 * days before now*, which is not a calendar week and cannot be aimed at one that has finished.
 * The only lever is the relative window, so this picks the narrowest one that still **contains**
 * the whole week — the narrower the window, the denser that week's posts sit inside the ranking,
 * and the fewer pages it takes to prove the top ten are the top ten.
 *
 * The cut-offs are padded below Lemmy's own (30 days, and a year) so a week can never end up
 * half-inside a window, which would quietly drop the older half of its posts.
 */
export function weeklyTopSort(week: WeekWindow, now = new Date()): "TopMonth" | "TopYear" | "TopAll" {
  const day = 86_400_000;
  if (week.start.getTime() >= now.getTime() - 28 * day) return "TopMonth";
  if (week.start.getTime() >= now.getTime() - 360 * day) return "TopYear";
  return "TopAll";
}
