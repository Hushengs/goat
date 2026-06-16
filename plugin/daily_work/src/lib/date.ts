import type { DailyItem, Summary, WeekdayKey } from "../types";

const weekdayOrder: WeekdayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const weekdayNames: Record<WeekdayKey, string> = {
  monday: "周一",
  tuesday: "周二",
  wednesday: "周三",
  thursday: "周四",
  friday: "周五",
  saturday: "周六",
  sunday: "周日",
};

export function getWeekdayKey(date: Date): WeekdayKey {
  const day = date.getDay();
  return weekdayOrder[(day + 6) % 7];
}

export function getWeekdayLabel(weekday: WeekdayKey): string {
  return weekdayNames[weekday];
}

export function getAllWeekdays(): WeekdayKey[] {
  return weekdayOrder;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTitle(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function toDateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getSummary(items: DailyItem[]): Summary {
  const done = items.filter((item) => item.status === "done").length;
  return {
    total: items.length,
    done,
    pending: items.length - done,
  };
}

export function getCountdownLabel(item: DailyItem, now: Date, dateKey: string): string {
  if (item.status === "done") {
    return "已完成";
  }

  const target = parseDateTime(dateKey, item.time);
  const diff = target.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const hours = `${Math.floor(absDiff / 3_600_000)}`.padStart(2, "0");
  const minutes = `${Math.floor((absDiff % 3_600_000) / 60_000)}`.padStart(2, "0");
  const seconds = `${Math.floor((absDiff % 60_000) / 1000)}`.padStart(2, "0");
  const text = `${hours}:${minutes}:${seconds}`;

  return diff >= 0 ? `剩余 ${text}` : `已超时 ${text}`;
}

export function getHistoryRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    dates.push(formatDateKey(date));
  }

  return dates;
}

function parseDateTime(dateKey: string, time: string): Date {
  const date = toDateFromKey(dateKey);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}
