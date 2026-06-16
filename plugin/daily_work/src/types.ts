export type WeekdayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type TaskStatus = "pending" | "done";
export type AppTab = "today" | "config" | "history";

export interface TemplateItem {
  id: string;
  title: string;
  time: string;
}

export interface DailyItem extends TemplateItem {
  status: TaskStatus;
}

export interface DailyRecord {
  weekday: WeekdayKey;
  items: DailyItem[];
}

export type WeeklyTemplates = Record<WeekdayKey, TemplateItem[]>;
export type DailyRecords = Record<string, DailyRecord>;

export interface Summary {
  total: number;
  done: number;
  pending: number;
}

export interface StorageData {
  templates: WeeklyTemplates;
  records: DailyRecords;
}
