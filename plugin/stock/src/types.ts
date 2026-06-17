export type RiskLevel = "low" | "medium" | "high";
export type MarketStatus = "trading" | "midday" | "closed";
export type StockFilter = "all" | "bullish" | "bearish" | "high-risk" | "holding" | "today";
export type OptionsTab = "pool" | "positions" | "settings" | "about";

export interface PriceRange {
  min: number;
  max: number;
}

export interface WatchStock {
  id: string;
  code: string;
  name: string;
  industry: string;
  tags: string[];
  note: string;
  latestPrice: number;
  prevClose: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  changePercent: number;
  volume: number;
  turnover: number;
  volumeRatio: number;
  amplitude: number;
  turnoverRate: number;
  ma5: number;
  ma10: number;
  ma20: number;
  trend5d: number;
  trend10d: number;
  trend20d: number;
  upProbability: number;
  downProbability: number;
  score: number;
  riskLevel: RiskLevel;
  reasons: string[];
  supportPrice: number;
  pressurePrice: number;
  buyPrice: number;
  buyRange: PriceRange;
  sellPrice: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  analysisUpdatedAt: string;
}

export interface Position {
  id: string;
  code: string;
  name: string;
  quantity: number;
  costPrice: number;
  latestPrice: number;
  prevClose: number;
  createdAt: string;
  updatedAt: string;
}

export interface StrategySettings {
  autoRefresh: boolean;
  refreshIntervalMinutes: 1 | 3 | 5;
  buyThreshold: number;
  sellThreshold: number;
  filterHighRisk: boolean;
  resourceLimit: number;
}

export interface Recommendation {
  code: string;
  name: string;
  probability: number;
  actionPrice: number;
  range?: PriceRange;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  riskLevel: RiskLevel;
  reasons: string[];
  updatedAt: string;
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalFloatingPnL: number;
  totalDailyPnL: number;
  gainCount: number;
  lossCount: number;
}

export interface StockSnapshot {
  stocks: WatchStock[];
  positions: Position[];
  settings: StrategySettings;
  updatedAt: string;
  lastError: string;
}

export interface DashboardData {
  bestBuy: Recommendation | null;
  bestSell: Recommendation | null;
  summary: PortfolioSummary;
}
