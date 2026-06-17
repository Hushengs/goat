import { useEffect, useMemo, useState } from "react";
import "../styles.css";
import { formatDateTime, formatMoney, formatPercent, formatSignedMoney, riskLevelLabel, riskLevelTone } from "../lib/format";
import { refreshSnapshotWithLiveData } from "../lib/eastmoney";
import { createStockDraft, getPortfolioSummary, syncPositionsWithStocks } from "../lib/market";
import { createId, findCatalogStock, readStorage, writeStorage } from "../lib/storage";
import type { OptionsTab, Position, StockSnapshot } from "../types";

const tabs: Array<{ key: OptionsTab; label: string }> = [
  { key: "pool", label: "资源池管理" },
  { key: "positions", label: "持仓管理" },
  { key: "settings", label: "策略与刷新" },
  { key: "about", label: "数据与说明" },
];

interface PositionDraft {
  code: string;
  quantity: string;
  costPrice: string;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<StockSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<OptionsTab>(readHashTab());
  const [poolQuery, setPoolQuery] = useState("");
  const [poolNote, setPoolNote] = useState("");
  const [positionDraft, setPositionDraft] = useState<PositionDraft>({ code: "", quantity: "", costPrice: "" });
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

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
    const onHashChange = () => setActiveTab(readHashTab());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const summary = useMemo(() => getPortfolioSummary(snapshot?.positions ?? []), [snapshot]);

  const persistSnapshot = async (next: StockSnapshot, message?: string) => {
    await writeStorage(next);
    setSnapshot(next);
    if (message) {
      setToast(message);
    }
  };

  const setTab = (tab: OptionsTab) => {
    window.location.hash = tab;
    setActiveTab(tab);
  };

  const addStock = async () => {
    if (!snapshot) {
      return;
    }

    if (snapshot.stocks.length >= snapshot.settings.resourceLimit) {
      setToast(`资源池已达到上限 ${snapshot.settings.resourceLimit} 只`);
      return;
    }

    const catalog = findCatalogStock(poolQuery);
    const code = catalog?.code ?? poolQuery.trim();
    const validCode = /^\d{6}$/.test(code);

    if (!validCode) {
      setToast("请输入合法的 6 位 A 股代码或已知股票名称");
      return;
    }

    if (snapshot.stocks.some((item) => item.code === code)) {
      setToast("该股票已在资源池中");
      return;
    }

    const stock = createStockDraft(
      code,
      catalog?.name ?? `股票 ${code}`,
      catalog?.industry ?? "待分类",
      catalog?.tags ?? ["自定义"],
      poolNote.trim(),
    );
    const next = {
      ...snapshot,
      stocks: [stock, ...snapshot.stocks],
      updatedAt: new Date().toISOString(),
    };

    try {
      const refreshed = await refreshSnapshotWithLiveData(next, [code]);
      await persistSnapshot(refreshed, refreshed.lastError || "已添加股票到资源池");
    } catch (error) {
      await persistSnapshot(
        {
          ...next,
          lastError: error instanceof Error ? `已添加股票，但实时行情获取失败：${error.message}` : "已添加股票，但实时行情获取失败",
        },
        "已添加股票，暂未拿到实时行情",
      );
    }
    setPoolQuery("");
    setPoolNote("");
  };

  const removeStock = async (stockId: string) => {
    if (!snapshot) {
      return;
    }

    const nextStocks = snapshot.stocks.filter((item) => item.id !== stockId);
    const nextPositions = snapshot.positions.filter((item) =>
      nextStocks.some((stock) => stock.code === item.code),
    );

    await persistSnapshot(
      {
        ...snapshot,
        stocks: nextStocks,
        positions: nextPositions,
        updatedAt: new Date().toISOString(),
      },
      "已删除股票",
    );
  };

  const updateStockNote = async (stockId: string, note: string) => {
    if (!snapshot) {
      return;
    }

    const next = {
      ...snapshot,
      stocks: snapshot.stocks.map((item) => (item.id === stockId ? { ...item, note } : item)),
    };

    await persistSnapshot(next);
  };

  const refreshStock = async (code: string) => {
    if (!snapshot) {
      return;
    }

    try {
      const next = await refreshSnapshotWithLiveData(snapshot, [code]);
      await persistSnapshot(next, next.lastError || "已刷新股票数据");
    } catch (error) {
      setToast(error instanceof Error ? `刷新失败：${error.message}` : "刷新失败");
    }
  };

  const refreshAll = async () => {
    if (!snapshot) {
      return;
    }

    try {
      const next = await refreshSnapshotWithLiveData(snapshot);
      await persistSnapshot(next, next.lastError || "已刷新全部股票");
    } catch (error) {
      setToast(error instanceof Error ? `刷新失败：${error.message}` : "刷新失败");
    }
  };

  const editPosition = (position: Position) => {
    setEditingPositionId(position.id);
    setPositionDraft({
      code: position.code,
      quantity: `${position.quantity}`,
      costPrice: `${position.costPrice}`,
    });
    setTab("positions");
  };

  const resetPositionDraft = () => {
    setEditingPositionId(null);
    setPositionDraft({ code: "", quantity: "", costPrice: "" });
  };

  const savePosition = async () => {
    if (!snapshot) {
      return;
    }

    const code = positionDraft.code.trim();
    const quantity = Number(positionDraft.quantity);
    const costPrice = Number(positionDraft.costPrice);

    if (!/^\d{6}$/.test(code)) {
      setToast("请填写合法股票代码");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setToast("持仓数量需大于 0");
      return;
    }

    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      setToast("成本价需大于 0");
      return;
    }

    let stocks = snapshot.stocks;
    let stock = stocks.find((item) => item.code === code);

    if (!stock) {
      const catalog = findCatalogStock(code);
      stock = createStockDraft(
        code,
        catalog?.name ?? `股票 ${code}`,
        catalog?.industry ?? "待分类",
        catalog?.tags ?? ["持仓关联"],
      );
      stocks = [stock, ...stocks];
    }

    const now = new Date().toISOString();
    const nextPosition: Position = {
      id: editingPositionId ?? createId("position"),
      code,
      name: stock.name,
      quantity: Math.round(quantity),
      costPrice,
      latestPrice: stock.latestPrice,
      prevClose: stock.prevClose,
      createdAt:
        snapshot.positions.find((item) => item.id === editingPositionId)?.createdAt ?? now,
      updatedAt: now,
    };

    const positions = editingPositionId
      ? snapshot.positions.map((item) => (item.id === editingPositionId ? nextPosition : item))
      : [nextPosition, ...snapshot.positions];

    const baseSnapshot = {
      ...snapshot,
      stocks,
      positions: syncPositionsWithStocks(positions, stocks),
      updatedAt: now,
    };

    try {
      const next = await refreshSnapshotWithLiveData(baseSnapshot, [code]);
      await persistSnapshot(next, next.lastError || (editingPositionId ? "已更新持仓" : "已新增持仓"));
    } catch (error) {
      await persistSnapshot(
        {
          ...baseSnapshot,
          lastError: error instanceof Error ? `持仓已保存，但实时行情获取失败：${error.message}` : "持仓已保存，但实时行情获取失败",
        },
        editingPositionId ? "已更新持仓，暂未刷新实时行情" : "已新增持仓，暂未刷新实时行情",
      );
    }
    resetPositionDraft();
  };

  const removePosition = async (positionId: string) => {
    if (!snapshot) {
      return;
    }

    await persistSnapshot(
      {
        ...snapshot,
        positions: snapshot.positions.filter((item) => item.id !== positionId),
        updatedAt: new Date().toISOString(),
      },
      "已删除持仓",
    );
  };

  const updateSetting = async <K extends keyof StockSnapshot["settings"]>(
    key: K,
    value: StockSnapshot["settings"][K],
  ) => {
    if (!snapshot) {
      return;
    }

    await persistSnapshot(
      {
        ...snapshot,
        settings: {
          ...snapshot.settings,
          [key]: value,
        },
      },
      "设置已自动保存，下次刷新后生效",
    );
  };

  if (loading || !snapshot) {
    return <div className="page-shell loading">正在加载配置...</div>;
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <div className="eyebrow">Options 配置页</div>
          <h1>A 股智能选股设置中心</h1>
          <p>本地保存资源池、持仓与策略阈值，适合一期离线演示与后续接入真实接口。</p>
        </div>
        <div className="header-side">
          <div className="summary-chip">资源池 {snapshot.stocks.length} / {snapshot.settings.resourceLimit}</div>
          <div className="summary-chip">持仓总市值 {formatMoney(summary.totalMarketValue)}</div>
          <button type="button" className="primary-button" onClick={() => void refreshAll()}>
            刷新全部
          </button>
        </div>
      </header>

      <nav className="page-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`page-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="page-content">
        {activeTab === "pool" ? (
          <section className="panel-stack">
            <section className="panel">
              <div className="section-heading">
                <h2>添加关注股票</h2>
                <span>支持代码或内置名称搜索</span>
              </div>
              <div className="form-row stretch">
                <input
                  className="input"
                  value={poolQuery}
                  placeholder="输入 6 位股票代码，如 600519"
                  onChange={(event) => setPoolQuery(event.target.value)}
                />
                <input
                  className="input"
                  value={poolNote}
                  placeholder="关注原因或备注"
                  onChange={(event) => setPoolNote(event.target.value)}
                />
                <button type="button" className="primary-button" onClick={() => void addStock()}>
                  添加股票
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>资源池列表</h2>
                <span>更新时间 {formatDateTime(snapshot.updatedAt)}</span>
              </div>
              <div className="table-list">
                {snapshot.stocks.map((stock) => (
                  <div key={stock.id} className="table-card">
                    <div className="table-card-head">
                      <div>
                        <div className="stock-name">{stock.name}</div>
                        <div className="stock-code">
                          {stock.code} · {stock.industry}
                        </div>
                      </div>
                      <div className="table-head-actions">
                        <span className={`risk-badge ${riskLevelTone(stock.riskLevel)}`}>
                          {riskLevelLabel(stock.riskLevel)}
                        </span>
                        <button type="button" className="icon-button" onClick={() => void refreshStock(stock.code)}>
                          刷新
                        </button>
                        <button type="button" className="icon-button danger" onClick={() => void removeStock(stock.id)}>
                          删除
                        </button>
                      </div>
                    </div>

                    <div className="metric-grid compact">
                      <MetricCell label="最新价" value={formatMoney(stock.latestPrice)} />
                      <MetricCell
                        label="涨跌幅"
                        value={formatPercent(stock.changePercent)}
                        tone={stock.changePercent >= 0 ? "rise" : "fall"}
                      />
                      <MetricCell label="上涨概率" value={`${stock.upProbability}%`} />
                      <MetricCell label="综合评分" value={`${stock.score} / 100`} />
                    </div>

                    <input
                      className="input"
                      value={stock.note}
                      placeholder="备注、行业看法、风险提醒"
                      onChange={(event) => void updateStockNote(stock.id, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "positions" ? (
          <section className="panel-stack">
            <section className="panel">
              <div className="section-heading">
                <h2>{editingPositionId ? "编辑持仓" : "新增持仓"}</h2>
                <span>股票代码会自动关联资源池行情</span>
              </div>
              <div className="form-row stretch">
                <input
                  className="input"
                  value={positionDraft.code}
                  placeholder="股票代码"
                  onChange={(event) =>
                    setPositionDraft((current) => ({ ...current, code: event.target.value.trim() }))
                  }
                />
                <input
                  className="input"
                  value={positionDraft.quantity}
                  placeholder="持仓数量"
                  onChange={(event) =>
                    setPositionDraft((current) => ({ ...current, quantity: event.target.value }))
                  }
                />
                <input
                  className="input"
                  value={positionDraft.costPrice}
                  placeholder="成本价"
                  onChange={(event) =>
                    setPositionDraft((current) => ({ ...current, costPrice: event.target.value }))
                  }
                />
                <button type="button" className="primary-button" onClick={() => void savePosition()}>
                  {editingPositionId ? "保存修改" : "新增持仓"}
                </button>
                {editingPositionId ? (
                  <button type="button" className="secondary-button" onClick={resetPositionDraft}>
                    取消
                  </button>
                ) : null}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>持仓列表</h2>
                <span>
                  盈利 {summary.gainCount} / 亏损 {summary.lossCount}
                </span>
              </div>
              {snapshot.positions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-title">暂无持仓</div>
                  <div className="empty-description">新增后即可在首页看到盈亏概览和卖出建议</div>
                </div>
              ) : (
                <div className="table-list">
                  {snapshot.positions.map((position) => {
                    const floatingPnL = (position.latestPrice - position.costPrice) * position.quantity;
                    const dailyPnL = (position.latestPrice - position.prevClose) * position.quantity;

                    return (
                      <div key={position.id} className="table-card">
                        <div className="table-card-head">
                          <div>
                            <div className="stock-name">{position.name}</div>
                            <div className="stock-code">{position.code}</div>
                          </div>
                          <div className="table-head-actions">
                            <button type="button" className="icon-button" onClick={() => editPosition(position)}>
                              编辑
                            </button>
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => void removePosition(position.id)}
                            >
                              删除
                            </button>
                          </div>
                        </div>

                        <div className="metric-grid">
                          <MetricCell label="数量" value={`${position.quantity}`} />
                          <MetricCell label="成本价" value={formatMoney(position.costPrice)} />
                          <MetricCell label="最新价" value={formatMoney(position.latestPrice)} />
                          <MetricCell label="持仓市值" value={formatMoney(position.latestPrice * position.quantity)} />
                          <MetricCell
                            label="浮动盈亏"
                            value={formatSignedMoney(floatingPnL)}
                            tone={floatingPnL >= 0 ? "rise" : "fall"}
                          />
                          <MetricCell
                            label="当日盈亏"
                            value={formatSignedMoney(dailyPnL)}
                            tone={dailyPnL >= 0 ? "rise" : "fall"}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="panel-stack">
            <section className="panel">
              <div className="section-heading">
                <h2>刷新设置</h2>
                <span>修改后自动保存到本地</span>
              </div>
              <div className="settings-grid">
                <label className="toggle-row">
                  <span>自动刷新</span>
                  <input
                    type="checkbox"
                    checked={snapshot.settings.autoRefresh}
                    onChange={(event) => void updateSetting("autoRefresh", event.target.checked)}
                  />
                </label>

                <label className="field-block">
                  <span>刷新频率</span>
                  <select
                    className="input"
                    value={snapshot.settings.refreshIntervalMinutes}
                    onChange={(event) =>
                      void updateSetting(
                        "refreshIntervalMinutes",
                        Number(event.target.value) as 1 | 3 | 5,
                      )
                    }
                  >
                    <option value={1}>1 分钟</option>
                    <option value={3}>3 分钟</option>
                    <option value={5}>5 分钟</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>策略阈值</h2>
                <span>阈值调整后下次刷新生效</span>
              </div>
              <div className="settings-grid">
                <label className="field-block">
                  <span>买入概率阈值</span>
                  <input
                    type="range"
                    min={40}
                    max={85}
                    value={snapshot.settings.buyThreshold}
                    onChange={(event) => void updateSetting("buyThreshold", Number(event.target.value))}
                  />
                  <strong>{snapshot.settings.buyThreshold}%</strong>
                </label>

                <label className="field-block">
                  <span>卖出概率阈值</span>
                  <input
                    type="range"
                    min={40}
                    max={85}
                    value={snapshot.settings.sellThreshold}
                    onChange={(event) => void updateSetting("sellThreshold", Number(event.target.value))}
                  />
                  <strong>{snapshot.settings.sellThreshold}%</strong>
                </label>

                <label className="toggle-row">
                  <span>买入时过滤高风险股票</span>
                  <input
                    type="checkbox"
                    checked={snapshot.settings.filterHighRisk}
                    onChange={(event) => void updateSetting("filterHighRisk", event.target.checked)}
                  />
                </label>

                <label className="field-block">
                  <span>资源池上限</span>
                  <input
                    type="number"
                    className="input"
                    min={10}
                    max={300}
                    value={snapshot.settings.resourceLimit}
                    onChange={(event) => void updateSetting("resourceLimit", Number(event.target.value))}
                  />
                </label>
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "about" ? (
          <section className="panel-stack">
            <section className="panel">
              <h2>数据来源说明</h2>
              <p className="long-text">
                当前版本会通过东方财富公开行情接口拉取实时价格与历史 K 线，并将资源池、持仓和配置保存到浏览器本地存储。
                如后续需要更高稳定性，可把刷新逻辑迁移到自建后端代理或 background 定时任务。
              </p>
            </section>

            <section className="panel">
              <h2>更新时间逻辑</h2>
              <p className="long-text">
                插件打开时会刷新一次本地分析结果。交易时段会显示“交易中”，非交易时段保留最近一次缓存数据，避免页面闪烁。
              </p>
              <div className="metric-grid compact">
                <MetricCell label="最近更新时间" value={formatDateTime(snapshot.updatedAt)} />
                <MetricCell label="刷新频率" value={`${snapshot.settings.refreshIntervalMinutes} 分钟`} />
              </div>
            </section>

            <section className="panel">
              <h2>风险免责声明</h2>
              <p className="long-text">
                本插件输出的买卖建议、概率和评分仅用于辅助决策，不构成任何投资承诺。正式上线前应接入稳定数据源，并补充更严格的风控与回测能力。
              </p>
            </section>
          </section>
        ) : null}
      </main>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function readHashTab(): OptionsTab {
  const hash = window.location.hash.replace("#", "");
  return tabs.some((item) => item.key === hash) ? (hash as OptionsTab) : "pool";
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
