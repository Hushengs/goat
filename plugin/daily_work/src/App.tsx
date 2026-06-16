import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  formatDateKey,
  formatDateTitle,
  getAllWeekdays,
  getCountdownLabel,
  getHistoryRange,
  getSummary,
  getWeekdayKey,
  getWeekdayLabel,
  toDateFromKey,
} from "./lib/date";
import {
  createTemplateItem,
  ensureTodayRecord,
  getRecordByDate,
  getTemplates,
  saveTemplates,
  syncTodayRecordFromTemplates,
  updateRecordItemStatus,
} from "./lib/storage";
import type { AppTab, DailyRecord, Summary, TemplateItem, WeekdayKey, WeeklyTemplates } from "./types";

const tabItems: { key: AppTab; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "config", label: "配置" },
  { key: "history", label: "历史" },
];

const emptySummary: Summary = {
  total: 0,
  done: 0,
  pending: 0,
};

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const [savedTemplates, setSavedTemplates] = useState<WeeklyTemplates | null>(null);
  const [draftTemplates, setDraftTemplates] = useState<WeeklyTemplates | null>(null);
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayKey>(getWeekdayKey(new Date()));

  const [todayRecord, setTodayRecord] = useState<DailyRecord | null>(null);
  const [historyDateKey, setHistoryDateKey] = useState(() => formatDateKey(new Date()));
  const [historyRecord, setHistoryRecord] = useState<DailyRecord | null>(null);

  const todayDateKey = formatDateKey(now);
  const todaySummary = todayRecord ? getSummary(todayRecord.items) : emptySummary;
  const historySummary = historyRecord ? getSummary(historyRecord.items) : emptySummary;
  const hasUnsavedChanges =
    savedTemplates !== null &&
    draftTemplates !== null &&
    JSON.stringify(savedTemplates) !== JSON.stringify(draftTemplates);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    void (async () => {
      const templates = await getTemplates();
      setSavedTemplates(templates);
      setDraftTemplates(templates);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const record = await ensureTodayRecord(new Date());
      setTodayRecord(record);
    })();
  }, [todayDateKey]);

  useEffect(() => {
    void (async () => {
      const record = await getRecordByDate(historyDateKey);
      setHistoryRecord(record);
    })();
  }, [historyDateKey]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const selectedItems = draftTemplates?.[selectedWeekday] ?? [];
  const historyShortcutDates = useMemo(() => getHistoryRange(7), []);

  const showToast = (message: string) => setToast(message);

  const updateTemplateItem = (
    weekday: WeekdayKey,
    itemId: string,
    field: keyof Pick<TemplateItem, "title" | "time">,
    value: string,
  ) => {
    setDraftTemplates((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [weekday]: current[weekday].map((item) =>
          item.id === itemId
            ? {
                ...item,
                [field]: value,
              }
            : item,
        ),
      };
    });
  };

  const addTemplateItem = () => {
    setDraftTemplates((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [selectedWeekday]: [...current[selectedWeekday], createTemplateItem(selectedWeekday)],
      };
    });
  };

  const removeTemplateItem = (itemId: string) => {
    setDraftTemplates((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [selectedWeekday]: current[selectedWeekday].filter((item) => item.id !== itemId),
      };
    });
  };

  const moveTemplateItem = (itemId: string, direction: -1 | 1) => {
    setDraftTemplates((current) => {
      if (!current) {
        return current;
      }

      const items = [...current[selectedWeekday]];
      const currentIndex = items.findIndex((item) => item.id === itemId);
      const targetIndex = currentIndex + direction;

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) {
        return current;
      }

      const [movedItem] = items.splice(currentIndex, 1);
      items.splice(targetIndex, 0, movedItem);

      return {
        ...current,
        [selectedWeekday]: items,
      };
    });
  };

  const saveTemplateChanges = async () => {
    if (!draftTemplates) {
      return;
    }

    const hasInvalidItem = Object.values(draftTemplates).some((items) =>
      items.some((item) => !item.title.trim() || !item.time),
    );

    if (hasInvalidItem) {
      showToast("请完善事项名称和时间");
      return;
    }

    const saved = await saveTemplates(draftTemplates);
    const syncedTodayRecord = await syncTodayRecordFromTemplates(new Date());
    setSavedTemplates(saved);
    setDraftTemplates(saved);
    setTodayRecord(syncedTodayRecord);
    if (historyDateKey === todayDateKey) {
      setHistoryRecord(syncedTodayRecord);
    }
    showToast("已保存");
  };

  const toggleTodayItem = async (itemId: string, checked: boolean) => {
    const updated = await updateRecordItemStatus(todayDateKey, itemId, checked ? "done" : "pending");
    if (!updated) {
      showToast("保存失败，请重试");
      return;
    }

    setTodayRecord(updated);
  };

  if (loading || !draftTemplates) {
    return <div className="shell loading">正在加载插件数据...</div>;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>每周事项倒计时</h1>
          <p>{formatDateTitle(now)}</p>
        </div>
        <div className="today-chip">{getWeekdayLabel(getWeekdayKey(now))}</div>
      </header>

      <nav className="tabs" aria-label="页面切换">
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {activeTab === "today" && (
          <TodayTab
            dateKey={todayDateKey}
            now={now}
            record={todayRecord}
            summary={todaySummary}
            onToggle={toggleTodayItem}
            onGoConfig={() => setActiveTab("config")}
          />
        )}

        {activeTab === "config" && (
          <ConfigTab
            hasUnsavedChanges={hasUnsavedChanges}
            items={selectedItems}
            selectedWeekday={selectedWeekday}
            onAdd={addTemplateItem}
            onDelete={removeTemplateItem}
            onFieldChange={updateTemplateItem}
            onMove={moveTemplateItem}
            onSave={saveTemplateChanges}
            onSelectWeekday={setSelectedWeekday}
          />
        )}

        {activeTab === "history" && (
          <HistoryTab
            dateKey={historyDateKey}
            record={historyRecord}
            shortcutDates={historyShortcutDates}
            summary={historySummary}
            onChangeDate={setHistoryDateKey}
          />
        )}
      </main>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

interface TodayTabProps {
  dateKey: string;
  now: Date;
  record: DailyRecord | null;
  summary: Summary;
  onToggle: (itemId: string, checked: boolean) => void;
  onGoConfig: () => void;
}

function TodayTab({ dateKey, now, record, summary, onToggle, onGoConfig }: TodayTabProps) {
  const items = record?.items ?? [];

  return (
    <section className="panel-stack">
      <section className="card hero-card">
        <div>
          <div className="section-label">今日概览</div>
          <h2>{formatDateTitle(now)}</h2>
        </div>
        <p>{summary.pending > 0 ? `今天共 ${summary.pending} 项待完成` : "今天的事项都处理好了"}</p>
      </section>

      <section className="stats-grid">
        <StatCard label="今日总数" value={summary.total} />
        <StatCard label="已完成" value={summary.done} tone="success" />
        <StatCard label="未完成" value={summary.pending} tone="warning" />
      </section>

      <section className="panel">
        <div className="section-heading">
          <h3>事项列表</h3>
          <span>{items.length} 项</span>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="今日暂无事项"
            description="可前往配置页添加每周固定事项"
            actionLabel="去配置"
            onAction={onGoConfig}
          />
        ) : (
          <div className="task-list">
            {items.map((item) => {
              const countdownLabel = getCountdownLabel(item, now, dateKey);
              const tone = item.status === "done" ? "done" : countdownLabel.startsWith("已超时") ? "late" : "normal";

              return (
                <label
                  key={item.id}
                  className={`task-card ${item.status === "done" ? "is-done" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={item.status === "done"}
                    onChange={(event) => onToggle(item.id, event.target.checked)}
                  />
                  <div className="task-main">
                    <div className="task-title">{item.title}</div>
                    <div className="task-meta">目标时间 {item.time}</div>
                  </div>
                  <div className={`task-status ${tone}`}>{countdownLabel}</div>
                </label>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

interface ConfigTabProps {
  hasUnsavedChanges: boolean;
  items: TemplateItem[];
  selectedWeekday: WeekdayKey;
  onAdd: () => void;
  onDelete: (itemId: string) => void;
  onFieldChange: (
    weekday: WeekdayKey,
    itemId: string,
    field: keyof Pick<TemplateItem, "title" | "time">,
    value: string,
  ) => void;
  onMove: (itemId: string, direction: -1 | 1) => void;
  onSave: () => void;
  onSelectWeekday: (weekday: WeekdayKey) => void;
}

function ConfigTab({
  hasUnsavedChanges,
  items,
  selectedWeekday,
  onAdd,
  onDelete,
  onFieldChange,
  onMove,
  onSave,
  onSelectWeekday,
}: ConfigTabProps) {
  const weekdays = getAllWeekdays();

  return (
    <section className="panel-stack">
      <section className="panel weekday-panel">
        <div className="section-heading">
          <h3>星期模板</h3>
          <span>{hasUnsavedChanges ? "有未保存修改" : "已同步"}</span>
        </div>
        <div className="weekday-tabs">
          {weekdays.map((weekday) => (
            <button
              key={weekday}
              type="button"
              className={`weekday-tab ${weekday === selectedWeekday ? "active" : ""}`}
              onClick={() => onSelectWeekday(weekday)}
            >
              {getWeekdayLabel(weekday)}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h3>{getWeekdayLabel(selectedWeekday)}事项</h3>
          <button type="button" className="text-button" onClick={onAdd}>
            新增事项
          </button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="当前星期暂无事项"
            description="新增第一项后即可保存为固定模板"
            actionLabel="新增第一项"
            onAction={onAdd}
          />
        ) : (
          <div className="config-list">
            {items.map((item, index) => (
              <div key={item.id} className="config-row">
                <input
                  type="text"
                  className="input title-input"
                  value={item.title}
                  placeholder="事项名称"
                  onChange={(event) =>
                    onFieldChange(selectedWeekday, item.id, "title", event.target.value)
                  }
                />
                <input
                  type="time"
                  className="input time-input"
                  value={item.time}
                  onChange={(event) =>
                    onFieldChange(selectedWeekday, item.id, "time", event.target.value)
                  }
                />
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onMove(item.id, -1)}
                    disabled={index === 0}
                    aria-label="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onMove(item.id, 1)}
                    disabled={index === items.length - 1}
                    aria-label="下移"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => onDelete(item.id)}
                    aria-label="删除"
                  >
                    删
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <button type="button" className="primary-button sticky-action" onClick={onSave}>
        保存配置
      </button>
    </section>
  );
}

interface HistoryTabProps {
  dateKey: string;
  record: DailyRecord | null;
  shortcutDates: string[];
  summary: Summary;
  onChangeDate: (dateKey: string) => void;
}

function HistoryTab({ dateKey, record, shortcutDates, summary, onChangeDate }: HistoryTabProps) {
  const historyDate = toDateFromKey(dateKey);

  return (
    <section className="panel-stack">
      <section className="panel">
        <div className="section-heading">
          <h3>选择日期</h3>
          <span>{formatDateTitle(historyDate)}</span>
        </div>
        <input
          type="date"
          className="input"
          value={dateKey}
          max={formatDateKey(new Date())}
          onChange={(event) => onChangeDate(event.target.value)}
        />
        <div className="shortcut-row">
          {shortcutDates.map((shortcutDate) => (
            <button
              key={shortcutDate}
              type="button"
              className={`shortcut-button ${shortcutDate === dateKey ? "active" : ""}`}
              onClick={() => onChangeDate(shortcutDate)}
            >
              {shortcutDate.slice(5)}
            </button>
          ))}
        </div>
      </section>

      {record ? (
        <>
          <section className="stats-grid">
            <StatCard label="当日总数" value={summary.total} />
            <StatCard label="已完成" value={summary.done} tone="success" />
            <StatCard label="未完成" value={summary.pending} tone="warning" />
          </section>

          <section className="panel">
            <div className="section-heading">
              <h3>历史事项</h3>
              <span>{getWeekdayLabel(record.weekday)}</span>
            </div>
            <div className="task-list">
              {record.items.map((item) => (
                <div key={item.id} className={`task-card ${item.status === "done" ? "is-done" : ""}`}>
                  <div className={`history-badge ${item.status === "done" ? "done" : "pending"}`}>
                    {item.status === "done" ? "已完成" : "未完成"}
                  </div>
                  <div className="task-main">
                    <div className="task-title">{item.title}</div>
                    <div className="task-meta">目标时间 {item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel">
          <EmptyState
            title="该日期暂无记录"
            description="当天可能没有生成事项或尚未打开过插件"
          />
        </section>
      )}
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
}

function StatCard({ label, value, tone = "default" }: StatCardProps) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      <div className="empty-description">{description}</div>
      {actionLabel && onAction ? (
        <button type="button" className="primary-button empty-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export default App;
