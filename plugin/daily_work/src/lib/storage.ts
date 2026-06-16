import { formatDateKey, getWeekdayKey } from "./date";
import type {
  DailyRecord,
  StorageData,
  TemplateItem,
  WeeklyTemplates,
  WeekdayKey,
} from "../types";

const STORAGE_KEY = "weekly-countdown-extension";

function createEmptyTemplates(): WeeklyTemplates {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

function createDefaultData(): StorageData {
  return {
    templates: createEmptyTemplates(),
    records: {},
  };
}

function normalizeData(input?: Partial<StorageData>): StorageData {
  const defaults = createDefaultData();

  return {
    templates: {
      ...defaults.templates,
      ...(input?.templates ?? {}),
    },
    records: input?.records ?? {},
  };
}

async function readRawStorage(): Promise<StorageData> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeData(stored[STORAGE_KEY] as Partial<StorageData> | undefined);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? normalizeData(JSON.parse(raw) as Partial<StorageData>) : createDefaultData();
}

async function writeRawStorage(data: StorageData): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function cloneTemplateItems(items: TemplateItem[]): TemplateItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title.trim(),
    time: item.time,
  }));
}

export async function getTemplates(): Promise<WeeklyTemplates> {
  const data = await readRawStorage();
  return data.templates;
}

export async function saveTemplates(templates: WeeklyTemplates): Promise<WeeklyTemplates> {
  const data = await readRawStorage();
  const normalizedTemplates = Object.fromEntries(
    Object.entries(templates).map(([weekday, items]) => [
      weekday,
      cloneTemplateItems(items).filter((item) => item.title && item.time),
    ]),
  ) as WeeklyTemplates;

  await writeRawStorage({
    ...data,
    templates: normalizedTemplates,
  });

  return normalizedTemplates;
}

export async function ensureTodayRecord(date: Date): Promise<DailyRecord> {
  const dateKey = formatDateKey(date);
  const data = await readRawStorage();
  const existing = data.records[dateKey];

  if (existing) {
    return existing;
  }

  const weekday = getWeekdayKey(date);
  const templateItems = data.templates[weekday] ?? [];
  const record: DailyRecord = {
    weekday,
    items: templateItems.map((item) => ({
      ...item,
      status: "pending",
    })),
  };

  await writeRawStorage({
    ...data,
    records: {
      ...data.records,
      [dateKey]: record,
    },
  });

  return record;
}

export async function syncTodayRecordFromTemplates(date: Date): Promise<DailyRecord> {
  const dateKey = formatDateKey(date);
  const data = await readRawStorage();
  const weekday = getWeekdayKey(date);
  const templateItems = data.templates[weekday] ?? [];
  const existing = data.records[dateKey];

  if (existing && existing.items.length > 0) {
    return existing;
  }

  const record: DailyRecord = {
    weekday,
    items: templateItems.map((item) => ({
      ...item,
      status: "pending",
    })),
  };

  await writeRawStorage({
    ...data,
    records: {
      ...data.records,
      [dateKey]: record,
    },
  });

  return record;
}

export async function getRecordByDate(dateKey: string): Promise<DailyRecord | null> {
  const data = await readRawStorage();
  return data.records[dateKey] ?? null;
}

export async function updateRecordItemStatus(
  dateKey: string,
  itemId: string,
  status: "pending" | "done",
): Promise<DailyRecord | null> {
  const data = await readRawStorage();
  const record = data.records[dateKey];

  if (!record) {
    return null;
  }

  const updatedRecord: DailyRecord = {
    ...record,
    items: record.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            status,
          }
        : item,
    ),
  };

  await writeRawStorage({
    ...data,
    records: {
      ...data.records,
      [dateKey]: updatedRecord,
    },
  });

  return updatedRecord;
}

export function createTemplateItem(weekday: WeekdayKey): TemplateItem {
  return {
    id: `${weekday}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    time: "09:00",
  };
}
