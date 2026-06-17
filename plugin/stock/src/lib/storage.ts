import type { Position, StockSnapshot, StrategySettings, WatchStock } from "../types";

const STORAGE_KEY = "stock-helper-extension";

const defaultSettings: StrategySettings = {
  autoRefresh: true,
  refreshIntervalMinutes: 3,
  buyThreshold: 60,
  sellThreshold: 60,
  filterHighRisk: true,
  resourceLimit: 100,
};

function createTimestamp(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const STOCK_CATALOG: Array<Pick<WatchStock, "code" | "name" | "industry" | "tags">> = [
  { code: "600519", name: "贵州茅台", industry: "白酒", tags: ["核心关注"] },
  { code: "000001", name: "平安银行", industry: "银行", tags: ["低估值"] },
  { code: "300750", name: "宁德时代", industry: "新能源", tags: ["成长"] },
  { code: "601318", name: "中国平安", industry: "保险", tags: ["价值"] },
  { code: "600036", name: "招商银行", industry: "银行", tags: ["稳健"] },
  { code: "002594", name: "比亚迪", industry: "新能源车", tags: ["高景气"] },
  { code: "600887", name: "伊利股份", industry: "食品饮料", tags: ["消费"] },
  { code: "600276", name: "恒瑞医药", industry: "医药", tags: ["防御"] },
];

function createDefaultStocks(): WatchStock[] {
  const now = createTimestamp();

  return [
    {
      id: createId("stock"),
      code: "600519",
      name: "贵州茅台",
      industry: "白酒",
      tags: ["核心关注"],
      note: "关注高位震荡后的量价变化",
      latestPrice: 1688,
      prevClose: 1675,
      openPrice: 1678,
      highPrice: 1696,
      lowPrice: 1671,
      changePercent: 0.78,
      volume: 123456,
      turnover: 208700000,
      volumeRatio: 1.12,
      amplitude: 1.49,
      turnoverRate: 0.82,
      ma5: 1672,
      ma10: 1661,
      ma20: 1638,
      trend5d: 2.4,
      trend10d: 4.1,
      trend20d: 6.8,
      upProbability: 68,
      downProbability: 32,
      score: 82,
      riskLevel: "medium",
      reasons: ["均线多头", "缩量整理", "机构偏好高"],
      supportPrice: 1672,
      pressurePrice: 1708,
      buyPrice: 1676,
      buyRange: { min: 1670, max: 1682 },
      sellPrice: 1698,
      takeProfitPrice: 1710,
      stopLossPrice: 1662,
      analysisUpdatedAt: now,
    },
    {
      id: createId("stock"),
      code: "000001",
      name: "平安银行",
      industry: "银行",
      tags: ["低估值"],
      note: "量价配合偏健康，适合观察回踩买点",
      latestPrice: 12.38,
      prevClose: 12.22,
      openPrice: 12.24,
      highPrice: 12.44,
      lowPrice: 12.18,
      changePercent: 1.31,
      volume: 652300,
      turnover: 80730000,
      volumeRatio: 1.26,
      amplitude: 2.13,
      turnoverRate: 1.88,
      ma5: 12.2,
      ma10: 12.08,
      ma20: 11.94,
      trend5d: 3.9,
      trend10d: 5.2,
      trend20d: 7.6,
      upProbability: 74,
      downProbability: 26,
      score: 86,
      riskLevel: "low",
      reasons: ["站上 MA10", "缩量回踩", "估值修复预期"],
      supportPrice: 12.22,
      pressurePrice: 12.58,
      buyPrice: 12.31,
      buyRange: { min: 12.26, max: 12.38 },
      sellPrice: 12.54,
      takeProfitPrice: 12.62,
      stopLossPrice: 12.12,
      analysisUpdatedAt: now,
    },
    {
      id: createId("stock"),
      code: "300750",
      name: "宁德时代",
      industry: "新能源",
      tags: ["成长"],
      note: "关注突破后的持续性和量比变化",
      latestPrice: 201.5,
      prevClose: 198.2,
      openPrice: 198.8,
      highPrice: 203.1,
      lowPrice: 197.9,
      changePercent: 1.67,
      volume: 423110,
      turnover: 85300000,
      volumeRatio: 1.48,
      amplitude: 2.62,
      turnoverRate: 2.34,
      ma5: 197.6,
      ma10: 194.9,
      ma20: 191.4,
      trend5d: 4.8,
      trend10d: 8.1,
      trend20d: 10.5,
      upProbability: 72,
      downProbability: 28,
      score: 84,
      riskLevel: "medium",
      reasons: ["放量突破", "行业景气", "趋势延续"],
      supportPrice: 198.4,
      pressurePrice: 205.8,
      buyPrice: 199.8,
      buyRange: { min: 198.9, max: 200.6 },
      sellPrice: 204.5,
      takeProfitPrice: 206.8,
      stopLossPrice: 196.2,
      analysisUpdatedAt: now,
    },
    {
      id: createId("stock"),
      code: "601318",
      name: "中国平安",
      industry: "保险",
      tags: ["价值"],
      note: "波动较小，适合稳健观察",
      latestPrice: 47.2,
      prevClose: 47.6,
      openPrice: 47.5,
      highPrice: 47.8,
      lowPrice: 47.1,
      changePercent: -0.84,
      volume: 301200,
      turnover: 14100000,
      volumeRatio: 0.96,
      amplitude: 1.47,
      turnoverRate: 0.73,
      ma5: 47.5,
      ma10: 47.8,
      ma20: 48.1,
      trend5d: -1.2,
      trend10d: -2.1,
      trend20d: -0.8,
      upProbability: 41,
      downProbability: 59,
      score: 46,
      riskLevel: "medium",
      reasons: ["跌破 MA10", "量能一般", "短线偏弱"],
      supportPrice: 46.8,
      pressurePrice: 47.9,
      buyPrice: 46.9,
      buyRange: { min: 46.8, max: 47.1 },
      sellPrice: 47.4,
      takeProfitPrice: 47.9,
      stopLossPrice: 46.7,
      analysisUpdatedAt: now,
    },
    {
      id: createId("stock"),
      code: "002594",
      name: "比亚迪",
      industry: "新能源车",
      tags: ["高景气"],
      note: "近期涨幅较大，注意追高风险",
      latestPrice: 259.6,
      prevClose: 255.8,
      openPrice: 256.2,
      highPrice: 261.4,
      lowPrice: 254.8,
      changePercent: 1.49,
      volume: 287600,
      turnover: 74900000,
      volumeRatio: 1.66,
      amplitude: 2.58,
      turnoverRate: 2.82,
      ma5: 252.1,
      ma10: 247.4,
      ma20: 240.5,
      trend5d: 5.6,
      trend10d: 10.1,
      trend20d: 14.8,
      upProbability: 69,
      downProbability: 31,
      score: 79,
      riskLevel: "high",
      reasons: ["趋势较强", "放量上攻", "短线乖离偏大"],
      supportPrice: 254.2,
      pressurePrice: 264.5,
      buyPrice: 255.4,
      buyRange: { min: 253.8, max: 256.7 },
      sellPrice: 262.1,
      takeProfitPrice: 264.8,
      stopLossPrice: 251.9,
      analysisUpdatedAt: now,
    },
  ];
}

function createDefaultPositions(): Position[] {
  const now = createTimestamp();

  return [
    {
      id: createId("position"),
      code: "600519",
      name: "贵州茅台",
      quantity: 100,
      costPrice: 1650,
      latestPrice: 1688,
      prevClose: 1675,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createId("position"),
      code: "601318",
      name: "中国平安",
      quantity: 500,
      costPrice: 48.3,
      latestPrice: 47.2,
      prevClose: 47.6,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function createDefaultSnapshot(): StockSnapshot {
  return {
    stocks: createDefaultStocks(),
    positions: createDefaultPositions(),
    settings: defaultSettings,
    updatedAt: createTimestamp(),
    lastError: "",
  };
}

function isRiskLevel(value: unknown): value is WatchStock["riskLevel"] {
  return value === "low" || value === "medium" || value === "high";
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeStock(input: unknown, index: number): WatchStock | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const item = input as Partial<WatchStock>;
  const now = createTimestamp();
  const code = typeof item.code === "string" ? item.code : "";
  const name = typeof item.name === "string" ? item.name : "";

  if (!code || !name) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : `stock-${index}`,
    code,
    name,
    industry: typeof item.industry === "string" ? item.industry : "未知行业",
    tags: normalizeStringArray(item.tags),
    note: typeof item.note === "string" ? item.note : "",
    latestPrice: normalizeNumber(item.latestPrice, 0),
    prevClose: normalizeNumber(item.prevClose, 0),
    openPrice: normalizeNumber(item.openPrice, 0),
    highPrice: normalizeNumber(item.highPrice, 0),
    lowPrice: normalizeNumber(item.lowPrice, 0),
    changePercent: normalizeNumber(item.changePercent, 0),
    volume: normalizeNumber(item.volume, 0),
    turnover: normalizeNumber(item.turnover, 0),
    volumeRatio: normalizeNumber(item.volumeRatio, 1),
    amplitude: normalizeNumber(item.amplitude, 0),
    turnoverRate: normalizeNumber(item.turnoverRate, 0),
    ma5: normalizeNumber(item.ma5, 0),
    ma10: normalizeNumber(item.ma10, 0),
    ma20: normalizeNumber(item.ma20, 0),
    trend5d: normalizeNumber(item.trend5d, 0),
    trend10d: normalizeNumber(item.trend10d, 0),
    trend20d: normalizeNumber(item.trend20d, 0),
    upProbability: normalizeNumber(item.upProbability, 50),
    downProbability: normalizeNumber(item.downProbability, 50),
    score: normalizeNumber(item.score, 50),
    riskLevel: isRiskLevel(item.riskLevel) ? item.riskLevel : "medium",
    reasons: normalizeStringArray(item.reasons),
    supportPrice: normalizeNumber(item.supportPrice, 0),
    pressurePrice: normalizeNumber(item.pressurePrice, 0),
    buyPrice: normalizeNumber(item.buyPrice, 0),
    buyRange: {
      min: normalizeNumber(item.buyRange?.min, 0),
      max: normalizeNumber(item.buyRange?.max, 0),
    },
    sellPrice: normalizeNumber(item.sellPrice, 0),
    takeProfitPrice: normalizeNumber(item.takeProfitPrice, 0),
    stopLossPrice: normalizeNumber(item.stopLossPrice, 0),
    analysisUpdatedAt: typeof item.analysisUpdatedAt === "string" ? item.analysisUpdatedAt : now,
  };
}

function normalizePosition(input: unknown, index: number): Position | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const item = input as Partial<Position>;
  const now = createTimestamp();

  if (typeof item.code !== "string" || typeof item.name !== "string") {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : `position-${index}`,
    code: item.code,
    name: item.name,
    quantity: Math.max(0, Math.round(normalizeNumber(item.quantity, 0))),
    costPrice: normalizeNumber(item.costPrice, 0),
    latestPrice: normalizeNumber(item.latestPrice, 0),
    prevClose: normalizeNumber(item.prevClose, 0),
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function normalizeSettings(input: unknown): StrategySettings {
  if (!input || typeof input !== "object") {
    return defaultSettings;
  }

  const item = input as Partial<StrategySettings>;
  const refreshIntervalMinutes =
    item.refreshIntervalMinutes === 1 || item.refreshIntervalMinutes === 3 || item.refreshIntervalMinutes === 5
      ? item.refreshIntervalMinutes
      : defaultSettings.refreshIntervalMinutes;

  return {
    autoRefresh: item.autoRefresh ?? defaultSettings.autoRefresh,
    refreshIntervalMinutes,
    buyThreshold: Math.min(100, Math.max(40, normalizeNumber(item.buyThreshold, defaultSettings.buyThreshold))),
    sellThreshold: Math.min(100, Math.max(40, normalizeNumber(item.sellThreshold, defaultSettings.sellThreshold))),
    filterHighRisk: item.filterHighRisk ?? defaultSettings.filterHighRisk,
    resourceLimit: Math.max(10, Math.min(300, Math.round(normalizeNumber(item.resourceLimit, defaultSettings.resourceLimit)))),
  };
}

function normalizeSnapshot(input?: Partial<StockSnapshot>): StockSnapshot {
  const defaults = createDefaultSnapshot();

  return {
    stocks:
      Array.isArray(input?.stocks)
        ? input.stocks.map(normalizeStock).filter((item): item is WatchStock => item !== null)
        : defaults.stocks,
    positions:
      Array.isArray(input?.positions)
        ? input.positions.map(normalizePosition).filter((item): item is Position => item !== null)
        : defaults.positions,
    settings: normalizeSettings(input?.settings),
    updatedAt: typeof input?.updatedAt === "string" ? input.updatedAt : defaults.updatedAt,
    lastError: typeof input?.lastError === "string" ? input.lastError : "",
  };
}

export async function readStorage(): Promise<StockSnapshot> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeSnapshot(stored[STORAGE_KEY] as Partial<StockSnapshot> | undefined);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? normalizeSnapshot(JSON.parse(raw) as Partial<StockSnapshot>) : createDefaultSnapshot();
}

export async function writeStorage(data: StockSnapshot): Promise<void> {
  const normalized = normalizeSnapshot(data);

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function findCatalogStock(query: string): Pick<WatchStock, "code" | "name" | "industry" | "tags"> | null {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return (
    STOCK_CATALOG.find((item) => item.code === normalized || item.name.toLowerCase().includes(normalized)) ?? null
  );
}
