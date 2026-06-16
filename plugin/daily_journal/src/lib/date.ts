export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateTitle(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function formatDateTimeLabel(isoText: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoText));
}

export function getCurrentWeekRange(date: Date): { start: string; end: string } {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  return {
    start: formatDateKey(startDate),
    end: formatDateKey(endDate),
  };
}

export function formatWeekRangeLabel(start: string, end: string): string {
  return `${start} ~ ${end}`;
}

export function getRecentDateKeys(days: number): string[] {
  const values: string[] = [];
  const today = new Date();

  for (let index = 0; index < days; index += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    values.push(formatDateKey(date));
  }

  return values;
}

export function formatHours(hours: number): string {
  const fixed = Number(hours.toFixed(2));
  return Number.isInteger(fixed) ? `${fixed}` : `${fixed}`;
}

export function formatHoursWithUnit(hours: number): string {
  return `${formatHours(hours)}H`;
}
