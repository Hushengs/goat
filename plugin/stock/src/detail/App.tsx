import { useEffect, useMemo, useState } from "react";
import "../styles.css";
import { formatCompactNumber, formatDateTime, formatMoney, formatPercent, riskLevelLabel, riskLevelTone } from "../lib/format";
import { refreshSnapshotWithLiveData } from "../lib/eastmoney";
import { getMarketStatus, getMarketStatusLabel } from "../lib/market";
import { readStorage, writeStorage } from "../lib/storage";
import type { StockSnapshot } from "../types";

function App() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<StockSnapshot | null>(null);
  const code = useMemo(() => new URLSearchParams(window.location.search).get("code") ?? "", []);

  useEffect(() => {
    void (async () => {
      const stored = await readStorage();
      if (!code) {
        setSnapshot(stored);
        setLoading(false);
        return;
      }

      try {
        const next = await refreshSnapshotWithLiveData(stored, [code]);
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
  }, [code]);

  const stock = snapshot?.stocks.find((item) => item.code === code) ?? null;

  const refresh = async () => {
    if (!snapshot || !stock) {
      return;
    }

    const next = await refreshSnapshotWithLiveData(snapshot, [stock.code]);
    await writeStorage(next);
    setSnapshot(next);
  };

  const openOptions = () => {
    const url =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("options.html#pool")
        : "options.html#pool";

    window.open(url, "_blank");
  };

  if (loading) {
    return <div className="page-shell loading">正在加载股票详情...</div>;
  }

  if (!stock) {
    return (
      <div className="page-shell">
        <section className="panel empty-state">
          <div className="empty-title">未找到股票详情</div>
          <div className="empty-description">该股票可能已从资源池删除，可返回配置页重新添加。</div>
          <button type="button" className="primary-button" onClick={openOptions}>
            打开资源池管理
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell detail-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">股票详情面板</div>
          <h1>
            {stock.name} <span className="inline-code">{stock.code}</span>
          </h1>
          <p>
            {stock.industry} · {riskLevelLabel(stock.riskLevel)} · 数据时间 {formatDateTime(stock.analysisUpdatedAt)}
          </p>
        </div>
        <div className="header-side">
          <span className={`risk-badge ${riskLevelTone(stock.riskLevel)}`}>{riskLevelLabel(stock.riskLevel)}</span>
          <button type="button" className="primary-button" onClick={() => void refresh()}>
            刷新分析
          </button>
        </div>
      </header>

      <main className="page-content">
        {snapshot?.lastError ? <div className="banner warning">{snapshot.lastError}</div> : null}
        <section className="panel">
          <div className="section-heading">
            <h2>实时行情区</h2>
            <span>{getMarketStatusLabel(getMarketStatus())}</span>
          </div>
          <div className="quote-hero">
            <div>
              <div className="quote-price">{formatMoney(stock.latestPrice)}</div>
              <div className={stock.changePercent >= 0 ? "rise-text" : "fall-text"}>
                {formatPercent(stock.changePercent)}
              </div>
            </div>
            <div className="metric-grid">
              <MetricCell label="开盘" value={formatMoney(stock.openPrice)} />
              <MetricCell label="最高" value={formatMoney(stock.highPrice)} />
              <MetricCell label="最低" value={formatMoney(stock.lowPrice)} />
              <MetricCell label="昨收" value={formatMoney(stock.prevClose)} />
              <MetricCell label="成交量" value={formatCompactNumber(stock.volume)} />
              <MetricCell label="成交额" value={formatCompactNumber(stock.turnover)} />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>趋势分析区</h2>
            <span>5 日 / 10 日 / 20 日</span>
          </div>
          <div className="metric-grid">
            <MetricCell label="近 5 日" value={formatPercent(stock.trend5d)} tone={stock.trend5d >= 0 ? "rise" : "fall"} />
            <MetricCell label="近 10 日" value={formatPercent(stock.trend10d)} tone={stock.trend10d >= 0 ? "rise" : "fall"} />
            <MetricCell label="近 20 日" value={formatPercent(stock.trend20d)} tone={stock.trend20d >= 0 ? "rise" : "fall"} />
            <MetricCell label="MA5" value={formatMoney(stock.ma5)} />
            <MetricCell label="MA10" value={formatMoney(stock.ma10)} />
            <MetricCell label="MA20" value={formatMoney(stock.ma20)} />
          </div>
          <p className="long-text">
            当前价格
            {stock.latestPrice >= stock.ma5 ? " 位于 MA5 上方，" : " 位于 MA5 下方，"}
            {stock.latestPrice >= stock.ma10 ? "短线维持偏强。" : "短线强度偏弱。"}
            {stock.latestPrice >= stock.ma20 ? " 中期结构仍相对稳定。" : " 中期结构需要继续观察。"}
          </p>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>概率分析区</h2>
            <span>规则评分模型</span>
          </div>
          <div className="metric-grid">
            <MetricCell label="上涨概率" value={`${stock.upProbability}%`} />
            <MetricCell label="下跌概率" value={`${stock.downProbability}%`} />
            <MetricCell label="综合评分" value={`${stock.score} / 100`} />
            <MetricCell label="量比" value={`${stock.volumeRatio.toFixed(2)}`} />
            <MetricCell label="振幅" value={formatPercent(stock.amplitude)} />
            <MetricCell label="换手率" value={formatPercent(stock.turnoverRate)} />
          </div>
          <ul className="reason-list">
            {stock.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>操作建议区</h2>
            <span>建议价格仅供参考</span>
          </div>
          <div className="metric-grid">
            <MetricCell label="建议买入价" value={formatMoney(stock.buyPrice)} />
            <MetricCell
              label="买入区间"
              value={`${formatMoney(stock.buyRange.min)} - ${formatMoney(stock.buyRange.max)}`}
            />
            <MetricCell label="建议卖出价" value={formatMoney(stock.sellPrice)} />
            <MetricCell label="参考止盈价" value={formatMoney(stock.takeProfitPrice)} />
            <MetricCell label="参考止损价" value={formatMoney(stock.stopLossPrice)} />
            <MetricCell label="关键支撑 / 压力" value={`${formatMoney(stock.supportPrice)} / ${formatMoney(stock.pressurePrice)}`} />
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>风险说明区</h2>
            <span>备注与提醒</span>
          </div>
          <p className="long-text">{stock.note || "暂无额外备注，可在 Options 页资源池管理中补充。"} </p>
          <p className="long-text">
            若价格跌破 {formatMoney(stock.stopLossPrice)} 建议转入观察；若上冲至 {formatMoney(stock.takeProfitPrice)}
            附近，可结合量能考虑分批止盈。
          </p>
        </section>
      </main>
    </div>
  );
}

function MetricCell({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "rise" | "fall";
}) {
  return (
    <div className={`metric-cell ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
