import { useEffect, useMemo, useState } from "react";
import "../styles.css";
import { formatCompactNumber, formatDateTime, formatMoney, formatPercent, formatSignedMoney, riskLevelLabel, riskLevelTone } from "../lib/format";
import { refreshSnapshotWithLiveData } from "../lib/eastmoney";
import { buildDashboardData, filterStocks, getMarketStatus, getMarketStatusLabel } from "../lib/market";
import { readStorage, writeStorage } from "../lib/storage";
import type { Recommendation, StockFilter, StockSnapshot, WatchStock } from "../types";

const filters: Array<{ key: StockFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "bullish", label: "高概率上涨" },
  { key: "bearish", label: "高概率下跌" },
  { key: "high-risk", label: "高风险" },
  { key: "holding", label: "持仓中" },
  { key: "today", label: "今日推荐" },
];

function App() {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StockFilter>("all");
  const [snapshot, setSnapshot] = useState<StockSnapshot | null>(null);
  const [toast, setToast] = useState("");
  const [refreshingCode, setRefreshingCode] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await readStorage();
      try {
        const next = await refreshSnapshotWithLiveData(stored);
        await writeStorage(next);
        setSnapshot(next);
      } catch (error) {
        setSnapshot({
          ...stored,
          lastError: error instanceof Error ? `实时行情获取失败：${error.message}` : "实时行情获取失败",
        });
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(""), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const marketStatus = getMarketStatus();
  const dashboard = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return buildDashboardData(snapshot.stocks, snapshot.positions, snapshot.settings);
  }, [snapshot]);

  const filteredStocks = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return filterStocks(snapshot.stocks, snapshot.positions, filter);
  }, [filter, snapshot]);

  const holdingCodes = useMemo(() => new Set(snapshot?.positions.map((item) => item.code) ?? []), [snapshot]);

  const persistSnapshot = async (next: StockSnapshot) => {
    await writeStorage(next);
    setSnapshot(next);
  };

  const handleRefreshAll = async () => {
    if (!snapshot) {
      return;
    }

    setRefreshingCode("all");
    try {
      const next = await refreshSnapshotWithLiveData(snapshot);
      await persistSnapshot(next);
      setToast(next.lastError || "已刷新最新分析");
    } catch (error) {
      setToast(error instanceof Error ? `刷新失败：${error.message}` : "刷新失败");
    } finally {
      setRefreshingCode(null);
    }
  };

  const handleRefreshOne = async (code: string) => {
    if (!snapshot) {
      return;
    }

    setRefreshingCode(code);
    try {
      const next = await refreshSnapshotWithLiveData(snapshot, [code]);
      await persistSnapshot(next);
      setToast(next.lastError || "已刷新股票数据");
    } catch (error) {
      setToast(error instanceof Error ? `刷新失败：${error.message}` : "刷新失败");
    } finally {
      setRefreshingCode(null);
    }
  };

  const openDetail = (code: string) => {
    const url =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL(`detail.html?code=${code}`)
        : `detail.html?code=${code}`;

    window.open(url, "_blank");
  };

  const openOptions = (tab: string) => {
    const url =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL(`options.html#${tab}`)
        : `options.html#${tab}`;

    window.open(url, "_blank");
  };

  if (loading || !snapshot || !dashboard) {
    return <LoadingView />;
  }

  return (
    <div className="shell popup-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">轻量辅助决策</div>
          <h1>A 股智能选股</h1>
          <p>{getMarketStatusLabel(marketStatus)} · 更新于 {formatDateTime(snapshot.updatedAt)}</p>
        </div>
        <div className="topbar-actions">
          <span className={`status-pill ${marketStatus}`}>{getMarketStatusLabel(marketStatus)}</span>
          <button
            type="button"
            className="icon-button"
            disabled={refreshingCode === "all"}
            onClick={() => void handleRefreshAll()}
          >
            {refreshingCode === "all" ? "刷新中" : "刷新"}
          </button>
          <button type="button" className="icon-button" onClick={() => openOptions("settings")}>
            设置
          </button>
        </div>
      </header>

      {snapshot.lastError ? <div className="banner warning">{snapshot.lastError}</div> : null}
      {marketStatus !== "trading" ? (
        <div className="banner muted">当前为 {getMarketStatusLabel(marketStatus)}，以下为最近一次有效数据。</div>
      ) : null}

      <section className="recommendation-grid">
        <RecommendationCard
          title="今日最适合买入"
          accent="buy"
          recommendation={dashboard.bestBuy}
          emptyText="今日暂无满足条件的买入机会"
          onDetail={openDetail}
        />
        <RecommendationCard
          title="今日最适合卖出"
          accent="sell"
          recommendation={dashboard.bestSell}
          emptyText="暂无持仓或暂无明确卖出信号"
          onDetail={openDetail}
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>持仓盈亏概览</h2>
          <span>{snapshot.positions.length > 0 ? `${snapshot.positions.length} 只持仓` : "暂无持仓"}</span>
        </div>
        {snapshot.positions.length === 0 ? (
          <EmptyState
            title="暂无持仓数据"
            description="录入持仓后可查看总市值、浮盈亏和当日盈亏"
            actionLabel="新增持仓"
            onAction={() => openOptions("positions")}
          />
        ) : (
          <div className="stats-grid two-columns">
            <StatCard label="总持仓市值" value={formatMoney(dashboard.summary.totalMarketValue)} />
            <StatCard
              label="总浮动盈亏"
              value={formatSignedMoney(dashboard.summary.totalFloatingPnL)}
              tone={dashboard.summary.totalFloatingPnL >= 0 ? "rise" : "fall"}
            />
            <StatCard
              label="总当日盈亏"
              value={formatSignedMoney(dashboard.summary.totalDailyPnL)}
              tone={dashboard.summary.totalDailyPnL >= 0 ? "rise" : "fall"}
            />
            <StatCard
              label="盈利 / 亏损"
              value={`${dashboard.summary.gainCount} / ${dashboard.summary.lossCount}`}
            />
          </div>
        )}
      </section>

      <section className="filter-row" aria-label="快捷筛选">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`filter-chip ${filter === item.key ? "active" : ""}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>资源池股票列表</h2>
          <span>{filteredStocks.length} 只</span>
        </div>
        {snapshot.stocks.length === 0 ? (
          <EmptyState
            title="还没有自选股票"
            description="先添加几只关注标的，插件会自动生成概率与建议"
            actionLabel="添加股票"
            onAction={() => openOptions("pool")}
          />
        ) : filteredStocks.length === 0 ? (
          <EmptyState title="当前筛选下暂无结果" description="可切换标签查看其他股票" />
        ) : (
          <div className="stock-list">
            {filteredStocks.slice(0, 10).map((stock) => (
              <StockRow
                key={stock.id}
                stock={stock}
                holding={holdingCodes.has(stock.code)}
                refreshing={refreshingCode === stock.code}
                onRefresh={handleRefreshOne}
                onDetail={openDetail}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="bottom-actions">
        <button type="button" className="secondary-button" onClick={() => openOptions("pool")}>
          管理资源池
        </button>
        <button type="button" className="secondary-button" onClick={() => openOptions("positions")}>
          管理持仓
        </button>
        <button type="button" className="secondary-button" onClick={() => openOptions("settings")}>
          打开设置
        </button>
      </footer>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function LoadingView() {
  return (
    <div className="shell popup-shell">
      <div className="topbar">
        <div>
          <div className="eyebrow">轻量辅助决策</div>
          <h1>A 股智能选股</h1>
          <p>正在初始化数据...</p>
        </div>
      </div>
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-card tall" />
    </div>
  );
}

function RecommendationCard({
  title,
  accent,
  recommendation,
  emptyText,
  onDetail,
}: {
  title: string;
  accent: "buy" | "sell";
  recommendation: Recommendation | null;
  emptyText: string;
  onDetail: (code: string) => void;
}) {
  return (
    <section className={`panel recommendation-card ${accent}`}>
      <div className="section-heading">
        <h2>{title}</h2>
        {recommendation ? (
          <span className={`risk-badge ${riskLevelTone(recommendation.riskLevel)}`}>
            {riskLevelLabel(recommendation.riskLevel)}
          </span>
        ) : null}
      </div>

      {recommendation ? (
        <>
          <div className="recommendation-head">
            <div>
              <div className="stock-name">{recommendation.name}</div>
              <div className="stock-code">{recommendation.code}</div>
            </div>
            <div className="probability-block">
              <strong>{recommendation.probability}%</strong>
              <span>{accent === "buy" ? "上涨概率" : "下跌概率"}</span>
            </div>
          </div>

          <div className="recommendation-prices">
            <div>
              <span>建议价</span>
              <strong>{formatMoney(recommendation.actionPrice)}</strong>
            </div>
            {recommendation.range ? (
              <div>
                <span>参考区间</span>
                <strong>
                  {formatMoney(recommendation.range.min)} - {formatMoney(recommendation.range.max)}
                </strong>
              </div>
            ) : null}
            {recommendation.takeProfitPrice ? (
              <div>
                <span>止盈价</span>
                <strong>{formatMoney(recommendation.takeProfitPrice)}</strong>
              </div>
            ) : null}
            {recommendation.stopLossPrice ? (
              <div>
                <span>止损位</span>
                <strong>{formatMoney(recommendation.stopLossPrice)}</strong>
              </div>
            ) : null}
          </div>

          <ul className="reason-list">
            {recommendation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          <button type="button" className="text-button align-start" onClick={() => onDetail(recommendation.code)}>
            查看详情
          </button>
        </>
      ) : (
        <div className="recommendation-empty">{emptyText}</div>
      )}
    </section>
  );
}

function StockRow({
  stock,
  holding,
  refreshing,
  onRefresh,
  onDetail,
}: {
  stock: WatchStock;
  holding: boolean;
  refreshing: boolean;
  onRefresh: (code: string) => void;
  onDetail: (code: string) => void;
}) {
  return (
    <div className="stock-row">
      <div className="stock-row-main">
        <div className="stock-row-top">
          <div>
            <div className="stock-name">{stock.name}</div>
            <div className="stock-code">
              {stock.code} · {stock.industry}
            </div>
          </div>
          <div className="price-block">
            <strong>{formatMoney(stock.latestPrice)}</strong>
            <span className={stock.changePercent >= 0 ? "rise-text" : "fall-text"}>
              {formatPercent(stock.changePercent)}
            </span>
          </div>
        </div>

        <div className="probability-bar">
          <div className="probability-segment buy" style={{ width: `${stock.upProbability}%` }}>
            {stock.upProbability}%
          </div>
          <div className="probability-segment sell" style={{ width: `${stock.downProbability}%` }}>
            {stock.downProbability}%
          </div>
        </div>

        <div className="stock-row-meta">
          <span className="score-badge">{stock.score} / 100</span>
          <span className={`risk-badge ${riskLevelTone(stock.riskLevel)}`}>{riskLevelLabel(stock.riskLevel)}</span>
          {holding ? <span className="holding-badge">持仓中</span> : null}
          <span>成交额 {formatCompactNumber(stock.turnover)}</span>
        </div>
      </div>

      <div className="row-actions vertical">
        <button type="button" className="icon-button" disabled={refreshing} onClick={() => onRefresh(stock.code)}>
          {refreshing ? "刷新中" : "刷新"}
        </button>
        <button type="button" className="icon-button" onClick={() => onDetail(stock.code)}>
          详情
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "rise" | "fall" }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      <div className="empty-description">{description}</div>
      {actionLabel && onAction ? (
        <button type="button" className="primary-button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export default App;
