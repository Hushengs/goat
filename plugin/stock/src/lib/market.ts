import { createId } from "./storage";
import type {
  DashboardData,
  MarketStatus,
  PortfolioSummary,
  Position,
  Recommendation,
  StockFilter,
  StockSnapshot,
  StrategySettings,
  WatchStock,
} from "../types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function getMarketStatus(now = new Date()): MarketStatus {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay();
  const totalMinutes = hour * 60 + minute;

  if (day === 0 || day === 6) {
    return "closed";
  }

  if (totalMinutes >= 570 && totalMinutes < 690) {
    return "trading";
  }

  if (totalMinutes >= 690 && totalMinutes < 780) {
    return "midday";
  }

  if (totalMinutes >= 780 && totalMinutes < 900) {
    return "trading";
  }

  return "closed";
}

export function getMarketStatusLabel(status: MarketStatus): string {
  if (status === "trading") {
    return "交易中";
  }

  if (status === "midday") {
    return "午间休市";
  }

  return "非交易时段";
}

function buildReasons(stock: WatchStock): string[] {
  const reasons: string[] = [];

  if (stock.latestPrice >= stock.ma5 && stock.ma5 >= stock.ma10) {
    reasons.push("均线多头");
  }

  if (stock.volumeRatio >= 1.2 && stock.changePercent > 0) {
    reasons.push("量价配合");
  }

  if (stock.trend5d > 0 && stock.trend10d > 0) {
    reasons.push("短中期趋势向上");
  }

  if (stock.latestPrice <= stock.supportPrice * 1.01) {
    reasons.push("接近支撑位");
  }

  if (stock.amplitude > 3 || stock.trend20d > 12) {
    reasons.push("波动偏大");
  }

  if (stock.latestPrice < stock.ma10) {
    reasons.push("跌破 MA10");
  }

  return reasons.slice(0, 3);
}

function scoreStock(stock: WatchStock): WatchStock {
  let score = 50;

  score += stock.latestPrice >= stock.ma5 ? 8 : -8;
  score += stock.latestPrice >= stock.ma10 ? 10 : -12;
  score += stock.latestPrice >= stock.ma20 ? 10 : -10;
  score += clamp(stock.trend5d, -6, 6) * 1.8;
  score += clamp(stock.trend10d, -8, 8) * 1.2;
  score += clamp((stock.volumeRatio - 1) * 16, -10, 10);
  score -= stock.amplitude > 4 ? 6 : 0;
  score -= stock.trend20d > 15 ? 4 : 0;
  score -= stock.latestPrice < stock.ma20 ? 6 : 0;

  const normalizedScore = Math.round(clamp(score, 18, 96));
  const upProbability = Math.round(clamp(30 + (normalizedScore - 20) * 0.7, 18, 86));
  const downProbability = 100 - upProbability;

  let riskLevel: WatchStock["riskLevel"] = "low";

  if (stock.amplitude > 3.6 || stock.trend20d > 12 || normalizedScore < 42) {
    riskLevel = "medium";
  }

  if (stock.amplitude > 4.6 || stock.trend20d > 16 || normalizedScore < 30) {
    riskLevel = "high";
  }

  const supportPrice = round(Math.min(stock.ma5, stock.ma10) || stock.latestPrice * 0.985);
  const pressurePrice = round(stock.latestPrice * (1 + clamp(upProbability / 250, 0.015, 0.05)));
  const buyPrice = round((supportPrice + stock.latestPrice) / 2);
  const sellPrice = round((pressurePrice + stock.latestPrice) / 2);
  const analyzedStock: WatchStock = {
    ...stock,
    score: normalizedScore,
    upProbability,
    downProbability,
    riskLevel,
    supportPrice,
    pressurePrice,
    buyPrice,
    buyRange: {
      min: round(buyPrice * 0.995),
      max: round(buyPrice * 1.005),
    },
    sellPrice,
    takeProfitPrice: round(pressurePrice * 1.006),
    stopLossPrice: round(Math.min(stock.ma10, stock.ma20) * 0.995),
    analysisUpdatedAt: new Date().toISOString(),
  };

  return {
    ...analyzedStock,
    reasons: buildReasons(analyzedStock),
  };
}

export function analyzeStock(stock: WatchStock): WatchStock {
  return scoreStock(stock);
}

function refreshOneStock(stock: WatchStock, marketStatus: MarketStatus): WatchStock {
  const drift = marketStatus === "closed" ? randomBetween(-0.003, 0.003) : randomBetween(-0.018, 0.022);
  const latestPrice = round(Math.max(1, stock.prevClose * (1 + drift)));
  const changePercent = round(((latestPrice - stock.prevClose) / stock.prevClose) * 100);
  const openPrice = round(stock.prevClose * (1 + randomBetween(-0.008, 0.008)));
  const highPrice = round(Math.max(latestPrice, openPrice) * (1 + randomBetween(0.002, 0.014)));
  const lowPrice = round(Math.min(latestPrice, openPrice) * (1 - randomBetween(0.002, 0.014)));
  const volumeRatio = round(clamp(stock.volumeRatio + randomBetween(-0.22, 0.32), 0.68, 2.38));
  const volume = Math.round(Math.max(10000, stock.volume * randomBetween(0.86, 1.18)));
  const turnover = Math.round(Math.max(800000, stock.turnover * randomBetween(0.84, 1.22)));
  const amplitude = round(((highPrice - lowPrice) / stock.prevClose) * 100);
  const turnoverRate = round(clamp(stock.turnoverRate + randomBetween(-0.35, 0.45), 0.2, 9.9));
  const trend5d = round(clamp(stock.trend5d + changePercent * 0.35 + randomBetween(-1.2, 1.4), -9, 12));
  const trend10d = round(clamp(stock.trend10d + changePercent * 0.2 + randomBetween(-1.1, 1.2), -14, 18));
  const trend20d = round(clamp(stock.trend20d + changePercent * 0.1 + randomBetween(-1.4, 1.6), -18, 26));
  const ma5 = round(stock.ma5 * 0.84 + latestPrice * 0.16);
  const ma10 = round(stock.ma10 * 0.9 + latestPrice * 0.1);
  const ma20 = round(stock.ma20 * 0.95 + latestPrice * 0.05);

  return scoreStock({
    ...stock,
    latestPrice,
    prevClose: stock.latestPrice,
    openPrice,
    highPrice,
    lowPrice,
    changePercent,
    volume,
    turnover,
    volumeRatio,
    amplitude,
    turnoverRate,
    trend5d,
    trend10d,
    trend20d,
    ma5,
    ma10,
    ma20,
  });
}

export function syncPositionsWithStocks(positions: Position[], stocks: WatchStock[]): Position[] {
  const stockMap = new Map(stocks.map((item) => [item.code, item]));

  return positions.map((position) => {
    const stock = stockMap.get(position.code);

    if (!stock) {
      return position;
    }

    return {
      ...position,
      name: stock.name,
      latestPrice: stock.latestPrice,
      prevClose: stock.prevClose,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function refreshSnapshot(snapshot: StockSnapshot): StockSnapshot {
  const marketStatus = getMarketStatus();
  const stocks = snapshot.stocks.map((stock) => refreshOneStock(stock, marketStatus));
  const positions = syncPositionsWithStocks(snapshot.positions, stocks);

  return {
    ...snapshot,
    stocks,
    positions,
    updatedAt: new Date().toISOString(),
    lastError: "",
  };
}

export function refreshSingleStock(snapshot: StockSnapshot, code: string): StockSnapshot {
  const marketStatus = getMarketStatus();
  const stocks = snapshot.stocks.map((stock) =>
    stock.code === code ? refreshOneStock(stock, marketStatus) : stock,
  );

  return {
    ...snapshot,
    stocks,
    positions: syncPositionsWithStocks(snapshot.positions, stocks),
    updatedAt: new Date().toISOString(),
    lastError: "",
  };
}

export function getPortfolioSummary(positions: Position[]): PortfolioSummary {
  return positions.reduce<PortfolioSummary>(
    (summary, position) => {
      const marketValue = position.latestPrice * position.quantity;
      const floatingPnL = (position.latestPrice - position.costPrice) * position.quantity;
      const dailyPnL = (position.latestPrice - position.prevClose) * position.quantity;

      return {
        totalMarketValue: summary.totalMarketValue + marketValue,
        totalFloatingPnL: summary.totalFloatingPnL + floatingPnL,
        totalDailyPnL: summary.totalDailyPnL + dailyPnL,
        gainCount: summary.gainCount + (floatingPnL >= 0 ? 1 : 0),
        lossCount: summary.lossCount + (floatingPnL < 0 ? 1 : 0),
      };
    },
    {
      totalMarketValue: 0,
      totalFloatingPnL: 0,
      totalDailyPnL: 0,
      gainCount: 0,
      lossCount: 0,
    },
  );
}

function toRecommendation(stock: WatchStock, type: "buy" | "sell"): Recommendation {
  if (type === "buy") {
    return {
      code: stock.code,
      name: stock.name,
      probability: stock.upProbability,
      actionPrice: stock.buyPrice,
      range: stock.buyRange,
      riskLevel: stock.riskLevel,
      reasons: stock.reasons,
      stopLossPrice: stock.stopLossPrice,
      updatedAt: stock.analysisUpdatedAt,
    };
  }

  return {
    code: stock.code,
    name: stock.name,
    probability: stock.downProbability,
    actionPrice: stock.sellPrice,
    riskLevel: stock.riskLevel,
    reasons: stock.reasons,
    takeProfitPrice: stock.takeProfitPrice,
    stopLossPrice: stock.stopLossPrice,
    updatedAt: stock.analysisUpdatedAt,
  };
}

export function buildDashboardData(stocks: WatchStock[], positions: Position[], settings: StrategySettings): DashboardData {
  const positionCodes = new Set(positions.map((item) => item.code));
  const buyCandidates = stocks
    .filter((stock) => stock.upProbability >= settings.buyThreshold)
    .filter((stock) => !settings.filterHighRisk || stock.riskLevel !== "high")
    .sort((left, right) => right.score - left.score || right.upProbability - left.upProbability);

  const sellCandidates = stocks
    .filter((stock) => positionCodes.has(stock.code))
    .filter((stock) => stock.downProbability >= settings.sellThreshold || stock.riskLevel === "high")
    .sort((left, right) => right.downProbability - left.downProbability || right.amplitude - left.amplitude);

  return {
    bestBuy: buyCandidates.length > 0 ? toRecommendation(buyCandidates[0], "buy") : null,
    bestSell: sellCandidates.length > 0 ? toRecommendation(sellCandidates[0], "sell") : null,
    summary: getPortfolioSummary(positions),
  };
}

export function filterStocks(stocks: WatchStock[], positions: Position[], filter: StockFilter): WatchStock[] {
  const positionCodes = new Set(positions.map((item) => item.code));

  return stocks.filter((stock) => {
    if (filter === "bullish") {
      return stock.upProbability >= 65;
    }

    if (filter === "bearish") {
      return stock.downProbability >= 60;
    }

    if (filter === "high-risk") {
      return stock.riskLevel === "high";
    }

    if (filter === "holding") {
      return positionCodes.has(stock.code);
    }

    if (filter === "today") {
      return stock.upProbability >= 68 || (positionCodes.has(stock.code) && stock.downProbability >= 60);
    }

    return true;
  });
}

export function createStockDraft(
  code: string,
  name: string,
  industry = "待分类",
  tags: string[] = [],
  note = "",
): WatchStock {
  const basePrice = round(randomBetween(10, 120));
  const prevClose = round(basePrice * randomBetween(0.98, 1.02));
  const seed: WatchStock = {
    id: createId("stock"),
    code,
    name,
    industry,
    tags,
    note,
    latestPrice: basePrice,
    prevClose,
    openPrice: prevClose,
    highPrice: round(basePrice * 1.01),
    lowPrice: round(basePrice * 0.99),
    changePercent: round(((basePrice - prevClose) / prevClose) * 100),
    volume: Math.round(randomBetween(80000, 900000)),
    turnover: Math.round(randomBetween(1000000, 120000000)),
    volumeRatio: round(randomBetween(0.9, 1.6)),
    amplitude: round(randomBetween(1.1, 3.8)),
    turnoverRate: round(randomBetween(0.8, 3.5)),
    ma5: round(basePrice * randomBetween(0.98, 1.01)),
    ma10: round(basePrice * randomBetween(0.97, 1.02)),
    ma20: round(basePrice * randomBetween(0.96, 1.03)),
    trend5d: round(randomBetween(-3, 6)),
    trend10d: round(randomBetween(-5, 8)),
    trend20d: round(randomBetween(-8, 12)),
    upProbability: 50,
    downProbability: 50,
    score: 50,
    riskLevel: "medium",
    reasons: [],
    supportPrice: round(basePrice * 0.98),
    pressurePrice: round(basePrice * 1.02),
    buyPrice: round(basePrice * 0.995),
    buyRange: {
      min: round(basePrice * 0.99),
      max: round(basePrice * 1.0),
    },
    sellPrice: round(basePrice * 1.01),
    takeProfitPrice: round(basePrice * 1.03),
    stopLossPrice: round(basePrice * 0.97),
    analysisUpdatedAt: new Date().toISOString(),
  };

  return scoreStock(seed);
}
