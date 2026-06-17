import { analyzeStock, syncPositionsWithStocks } from "./market";
import type { StockSnapshot, WatchStock } from "../types";

interface QuoteItem {
  f2: number;
  f3: number;
  f4: number;
  f5: number;
  f6: number;
  f7: number;
  f8: number;
  f10: number;
  f12: string;
  f14: string;
  f15: number;
  f16: number;
  f17: number;
  f18: number;
}

interface QuoteResponse {
  data?: {
    diff?: QuoteItem[];
  };
}

interface KlineResponse {
  data?: {
    klines?: string[];
  };
}

interface ParsedKline {
  close: number;
}

interface RefreshStocksResult {
  stocks: WatchStock[];
  errors: string[];
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toSecid(code: string): string {
  return /^(5|6|9)/.test(code) ? `1.${code}` : `0.${code}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json, text/plain, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`);
  }

  return (await response.json()) as T;
}

async function fetchQuotes(codes: string[]): Promise<Map<string, QuoteItem>> {
  const secids = codes.map(toSecid).join(",");
  const url =
    "https://push2.eastmoney.com/api/qt/ulist.np/get" +
    `?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f7,f8,f10,f12,f14,f15,f16,f17,f18&secids=${secids}`;
  const payload = await fetchJson<QuoteResponse>(url);
  const items = payload.data?.diff ?? [];

  return new Map(items.map((item) => [item.f12, item]));
}

function parseKlines(raw: string[]): ParsedKline[] {
  return raw
    .map((line) => line.split(","))
    .filter((parts) => parts.length >= 3)
    .map((parts) => ({
      close: Number(parts[2]),
    }))
    .filter((item) => Number.isFinite(item.close) && item.close > 0);
}

async function fetchKlines(code: string): Promise<ParsedKline[]> {
  const url =
    "https://push2his.eastmoney.com/api/qt/stock/kline/get" +
    `?secid=${toSecid(code)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&lmt=30&end=20500101`;
  const payload = await fetchJson<KlineResponse>(url);
  return parseKlines(payload.data?.klines ?? []);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function movingAverage(closes: number[], windowSize: number): number {
  return average(closes.slice(-windowSize));
}

function trendPercent(closes: number[], sessions: number): number {
  if (closes.length === 0) {
    return 0;
  }

  const latest = closes[closes.length - 1];
  const baseIndex = Math.max(0, closes.length - sessions - 1);
  const base = closes[baseIndex];

  if (!base) {
    return 0;
  }

  return round(((latest - base) / base) * 100);
}

function buildLiveStock(base: WatchStock, quote: QuoteItem, klines: ParsedKline[]): WatchStock {
  const historicalCloses = klines.map((item) => item.close);
  const closes =
    historicalCloses.length === 0
      ? [quote.f18, quote.f2].filter((item) => Number.isFinite(item) && item > 0)
      : [...historicalCloses.slice(0, -1), quote.f2];

  return analyzeStock({
    ...base,
    code: quote.f12 || base.code,
    name: quote.f14 || base.name,
    latestPrice: quote.f2,
    prevClose: quote.f18,
    openPrice: quote.f17,
    highPrice: quote.f15,
    lowPrice: quote.f16,
    changePercent: quote.f3,
    volume: quote.f5,
    turnover: quote.f6,
    volumeRatio: quote.f10,
    amplitude: quote.f7,
    turnoverRate: quote.f8,
    ma5: movingAverage(closes, 5),
    ma10: movingAverage(closes, 10),
    ma20: movingAverage(closes, 20),
    trend5d: trendPercent(closes, 5),
    trend10d: trendPercent(closes, 10),
    trend20d: trendPercent(closes, 20),
  });
}

async function refreshStocksWithLiveData(
  stocks: WatchStock[],
  targetCodes?: string[],
): Promise<RefreshStocksResult> {
  const targetSet = targetCodes ? new Set(targetCodes) : null;
  const targetStocks = targetSet ? stocks.filter((stock) => targetSet.has(stock.code)) : stocks;

  if (targetStocks.length === 0) {
    return {
      stocks,
      errors: [],
    };
  }

  const quoteMap = await fetchQuotes(targetStocks.map((stock) => stock.code));
  const refreshedEntries = await Promise.all(
    targetStocks.map(async (stock) => {
      try {
        const quote = quoteMap.get(stock.code);

        if (!quote || !Number.isFinite(quote.f2) || quote.f2 <= 0) {
          throw new Error(`${stock.code} 行情为空`);
        }

        const klines = await fetchKlines(stock.code);
        return {
          code: stock.code,
          stock: buildLiveStock(stock, quote, klines),
          error: "",
        };
      } catch (error) {
        return {
          code: stock.code,
          stock,
          error: error instanceof Error ? `${stock.code} ${error.message}` : `${stock.code} 更新失败`,
        };
      }
    }),
  );

  const stockMap = new Map(refreshedEntries.map((entry) => [entry.code, entry.stock]));

  return {
    stocks: stocks.map((stock) => stockMap.get(stock.code) ?? stock),
    errors: refreshedEntries.map((entry) => entry.error).filter(Boolean),
  };
}

export async function refreshSnapshotWithLiveData(
  snapshot: StockSnapshot,
  targetCodes?: string[],
): Promise<StockSnapshot> {
  const { stocks, errors } = await refreshStocksWithLiveData(snapshot.stocks, targetCodes);

  return {
    ...snapshot,
    stocks,
    positions: syncPositionsWithStocks(snapshot.positions, stocks),
    updatedAt: new Date().toISOString(),
    lastError:
      errors.length > 0 ? `部分股票更新失败：${errors.slice(0, 3).join("；")}，已保留旧数据` : "",
  };
}
