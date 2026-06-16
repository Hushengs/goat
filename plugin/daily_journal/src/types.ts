export type AppTab = "records" | "projects" | "history" | "summary";

export interface Project {
  id: string;
  name: string;
  owner: string;
  sortOrder: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkRecord {
  id: string;
  projectId: string;
  projectName: string;
  projectOwner: string;
  content: string;
  hours: number;
  createdAt: string;
  updatedAt: string;
}

export type WorkRecordsByDate = Record<string, WorkRecord[]>;

export interface StorageData {
  projects: Project[];
  records: WorkRecordsByDate;
}

export interface RecordDraft {
  projectId: string;
  content: string;
  hours: string;
}

export interface ProjectDraft {
  name: string;
  owner: string;
  sortOrder: string;
  enabled: boolean;
}

export interface WeeklySummaryItem {
  id: string;
  date: string;
  content: string;
  hours: number;
  createdAt: string;
}

export interface WeeklySummaryGroup {
  projectId: string;
  projectName: string;
  projectOwner: string;
  projectHours: number;
  items: WeeklySummaryItem[];
}

export interface WeeklySummary {
  weekRange: {
    start: string;
    end: string;
  };
  totalHours: number;
  groups: WeeklySummaryGroup[];
  text: string;
}
