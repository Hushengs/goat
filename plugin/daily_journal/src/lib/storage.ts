import type { Project, StorageData, WorkRecord, WorkRecordsByDate } from "../types";

const STORAGE_KEY = "daily-journal-extension";

function createDefaultData(): StorageData {
  return {
    projects: [],
    records: {},
  };
}

function normalizeProjects(projects: unknown): Project[] {
  if (!Array.isArray(projects)) {
    return [];
  }

  return projects
    .filter((item): item is Partial<Project> => typeof item === "object" && item !== null)
    .map((item, index) => ({
      id: typeof item.id === "string" ? item.id : `project-${index}`,
      name: typeof item.name === "string" ? item.name : "",
      owner: typeof item.owner === "string" ? item.owner : "",
      sortOrder: typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder) ? item.sortOrder : null,
      enabled: item.enabled !== false,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
    }));
}

function normalizeRecords(records: unknown): WorkRecordsByDate {
  if (!records || typeof records !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(records).map(([dateKey, items]) => [
      dateKey,
      Array.isArray(items)
        ? items
            .filter((item): item is Partial<WorkRecord> => typeof item === "object" && item !== null)
            .map((item, index) => ({
              id: typeof item.id === "string" ? item.id : `${dateKey}-${index}`,
              projectId: typeof item.projectId === "string" ? item.projectId : "",
              projectName: typeof item.projectName === "string" ? item.projectName : "未命名项目",
              projectOwner: typeof item.projectOwner === "string" ? item.projectOwner : "",
              content: typeof item.content === "string" ? item.content : "",
              hours: typeof item.hours === "number" && Number.isFinite(item.hours) ? item.hours : 0,
              createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
              updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
            }))
            .filter((item) => item.content.trim() && item.hours > 0)
        : [],
    ]),
  );
}

function normalizeData(input?: Partial<StorageData>): StorageData {
  const defaults = createDefaultData();
  return {
    projects: normalizeProjects(input?.projects ?? defaults.projects),
    records: normalizeRecords(input?.records ?? defaults.records),
  };
}

export async function readStorage(): Promise<StorageData> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeData(stored[STORAGE_KEY] as Partial<StorageData> | undefined);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? normalizeData(JSON.parse(raw) as Partial<StorageData>) : createDefaultData();
}

export async function writeStorage(data: StorageData): Promise<void> {
  const normalized = normalizeData(data);

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
