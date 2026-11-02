import { fail } from "./auth";

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(day: string): number {
  const ms = DAY_FORMAT.test(day) ? Date.parse(day + "T00:00:00Z") : NaN;
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) fail("BAD_DAY");
  return ms;
}

// 31 stycznia + 1 miesiąc = 28/29 lutego, nie 3 marca.
export function addMonths(day: string, months: number): string {
  const d = new Date(parseDay(day));
  const target = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const year = Math.floor(target / 12);
  const month = target % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d.getUTCDate(), lastDay))).toISOString().slice(0, 10);
}
