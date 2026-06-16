import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  formatDateKey,
  formatDateTimeLabel,
  formatDateTitle,
  formatHoursWithUnit,
  formatWeekRangeLabel,
  getCurrentWeekRange,
  getRecentDateKeys,
  toDateFromKey,
} from "./lib/date";
import { createId, readStorage, writeStorage } from "./lib/storage";
import type {
  AppTab,
  Project,
  ProjectDraft,
  RecordDraft,
  StorageData,
  WeeklySummary,
  WeeklySummaryGroup,
  WorkRecord,
  WorkRecordsByDate,
} from "./types";

const tabItems: Array<{ key: AppTab; label: string }> = [
  { key: "records", label: "记录" },
  { key: "projects", label: "项目" },
  { key: "history", label: "历史" },
  { key: "summary", label: "汇总" },
];

function App() {
  const todayKey = formatDateKey(new Date());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>("records");
  const [toast, setToast] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<WorkRecordsByDate>({});

  const [recordDateKey, setRecordDateKey] = useState(todayKey);
  const [historyDateKey, setHistoryDateKey] = useState(todayKey);
  const [historyRangeDays, setHistoryRangeDays] = useState<7 | 30>(7);

  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(createEmptyProjectDraft());
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [recordDraft, setRecordDraft] = useState<RecordDraft>(createEmptyRecordDraft());
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  const [historyDraft, setHistoryDraft] = useState<RecordDraft>(createEmptyRecordDraft());
  const [editingHistoryRecordId, setEditingHistoryRecordId] = useState<string | null>(null);

  const [summaryData, setSummaryData] = useState<WeeklySummary>(() =>
    buildWeeklySummary([], {}, new Date()),
  );

  useEffect(() => {
    void (async () => {
      const stored = await readStorage();
      setProjects(stored.projects);
      setRecords(stored.records);
      setSummaryData(buildWeeklySummary(stored.projects, stored.records, new Date()));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    setSummaryData(buildWeeklySummary(projects, records, new Date()));
  }, [projects, records]);

  useEffect(() => {
    setEditingRecordId(null);
    setRecordDraft(createEmptyRecordDraft());
  }, [recordDateKey]);

  useEffect(() => {
    setEditingHistoryRecordId(null);
    setHistoryDraft(createEmptyRecordDraft());
  }, [historyDateKey]);

  const sortedProjects = useMemo(() => sortProjects(projects), [projects]);
  const enabledProjects = useMemo(
    () => sortedProjects.filter((project) => project.enabled),
    [sortedProjects],
  );

  const selectedDateRecords = useMemo(
    () => sortRecordsNewestFirst(records[recordDateKey] ?? []),
    [records, recordDateKey],
  );
  const historyRecords = useMemo(
    () => sortRecordsNewestFirst(records[historyDateKey] ?? []),
    [records, historyDateKey],
  );

  const recordHoursTotal = useMemo(
    () => sumHours(records[recordDateKey] ?? []),
    [records, recordDateKey],
  );
  const historyHoursTotal = useMemo(
    () => sumHours(records[historyDateKey] ?? []),
    [records, historyDateKey],
  );

  const editingRecord = editingRecordId
    ? (records[recordDateKey] ?? []).find((item) => item.id === editingRecordId) ?? null
    : null;
  const editingHistoryRecord = editingHistoryRecordId
    ? (records[historyDateKey] ?? []).find((item) => item.id === editingHistoryRecordId) ?? null
    : null;

  const recordFormProjects = useMemo(
    () => getSelectableProjects(sortedProjects, editingRecord),
    [sortedProjects, editingRecord],
  );
  const historyFormProjects = useMemo(
    () => getSelectableProjects(sortedProjects, editingHistoryRecord),
    [sortedProjects, editingHistoryRecord],
  );
  const historyQuickDates = useMemo(() => getRecentDateKeys(historyRangeDays), [historyRangeDays]);

  const showToast = (message: string) => setToast(message);

  const persistState = async (
    nextProjects: Project[],
    nextRecords: WorkRecordsByDate,
  ): Promise<boolean> => {
    const payload: StorageData = {
      projects: nextProjects,
      records: nextRecords,
    };

    try {
      await writeStorage(payload);
      setProjects(nextProjects);
      setRecords(nextRecords);
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败，请重试");
      return false;
    }
  };

  const resetProjectEditor = () => {
    setEditingProjectId(null);
    setProjectDraft(createEmptyProjectDraft());
  };

  const saveProject = async () => {
    const name = projectDraft.name.trim();
    const owner = projectDraft.owner.trim();
    const sortText = projectDraft.sortOrder.trim();

    if (!name) {
      showToast("请填写项目名称");
      return;
    }

    if (sortText && !/^\d+$/.test(sortText)) {
      showToast("排序号需为非负整数");
      return;
    }

    const now = new Date().toISOString();
    const sortOrder = sortText ? Number(sortText) : null;
    const nextProjects = editingProjectId
      ? projects.map((project) =>
          project.id === editingProjectId
            ? {
                ...project,
                name,
                owner,
                sortOrder,
                enabled: projectDraft.enabled,
                updatedAt: now,
              }
            : project,
        )
      : [
          ...projects,
          {
            id: createId("project"),
            name,
            owner,
            sortOrder,
            enabled: projectDraft.enabled,
            createdAt: now,
            updatedAt: now,
          },
        ];

    const saved = await persistState(nextProjects, records);
    if (!saved) {
      return;
    }

    resetProjectEditor();
    showToast(editingProjectId ? "已更新项目" : "已保存项目");
  };

  const editProject = (project: Project) => {
    setEditingProjectId(project.id);
    setProjectDraft({
      name: project.name,
      owner: project.owner,
      sortOrder: project.sortOrder === null ? "" : `${project.sortOrder}`,
      enabled: project.enabled,
    });
    setActiveTab("projects");
  };

  const deleteProject = async (projectId: string) => {
    const confirmed = window.confirm("确定删除该项目吗？历史记录会保留已保存的项目快照。");
    if (!confirmed) {
      return;
    }

    const nextProjects = projects.filter((project) => project.id !== projectId);
    const saved = await persistState(nextProjects, records);
    if (!saved) {
      return;
    }

    if (editingProjectId === projectId) {
      resetProjectEditor();
    }
    showToast("已删除项目");
  };

  const saveRecord = async (
    dateKey: string,
    draft: RecordDraft,
    currentEditId: string | null,
    resetEditor: () => void,
  ) => {
    const content = draft.content.trim();
    const hoursText = draft.hours.trim();
    const dateItems = records[dateKey] ?? [];
    const existing = currentEditId
      ? dateItems.find((item) => item.id === currentEditId) ?? null
      : null;
    const selectedProject = sortedProjects.find((project) => project.id === draft.projectId) ?? null;

    if (!draft.projectId) {
      showToast("请选择项目");
      return;
    }

    if (!content) {
      showToast("请填写工作事项");
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(hoursText)) {
      showToast("工时需为大于 0 的数字，最多保留 2 位小数");
      return;
    }

    const hours = Number(hoursText);
    if (hours <= 0) {
      showToast("工时必须大于 0");
      return;
    }

    if (!selectedProject && !existing) {
      showToast("所选项目不存在，请重新选择");
      return;
    }

    const now = new Date().toISOString();
    const projectId = selectedProject?.id ?? existing?.projectId ?? draft.projectId;
    const projectName = selectedProject?.name ?? existing?.projectName ?? "未命名项目";
    const projectOwner = selectedProject?.owner ?? existing?.projectOwner ?? "";

    const nextRecord: WorkRecord = currentEditId && existing
      ? {
          ...existing,
          projectId,
          projectName,
          projectOwner,
          content,
          hours,
          updatedAt: now,
        }
      : {
          id: createId("record"),
          projectId,
          projectName,
          projectOwner,
          content,
          hours,
          createdAt: now,
          updatedAt: now,
        };

    const nextDateItems = currentEditId
      ? dateItems.map((item) => (item.id === currentEditId ? nextRecord : item))
      : [nextRecord, ...dateItems];
    const nextRecords = {
      ...records,
      [dateKey]: nextDateItems,
    };

    const saved = await persistState(projects, nextRecords);
    if (!saved) {
      return;
    }

    resetEditor();
    showToast(currentEditId ? "已更新记录" : "已保存记录");
  };

  const deleteRecord = async (dateKey: string, recordId: string) => {
    const confirmed = window.confirm("确定删除这条工作记录吗？");
    if (!confirmed) {
      return;
    }

    const dateItems = records[dateKey] ?? [];
    const remaining = dateItems.filter((item) => item.id !== recordId);
    const nextRecords = { ...records };

    if (remaining.length > 0) {
      nextRecords[dateKey] = remaining;
    } else {
      delete nextRecords[dateKey];
    }

    const saved = await persistState(projects, nextRecords);
    if (!saved) {
      return;
    }

    if (editingRecordId === recordId) {
      setEditingRecordId(null);
      setRecordDraft(createEmptyRecordDraft());
    }
    if (editingHistoryRecordId === recordId) {
      setEditingHistoryRecordId(null);
      setHistoryDraft(createEmptyRecordDraft());
    }
    showToast("已删除记录");
  };

  const refreshSummary = () => {
    setSummaryData(buildWeeklySummary(projects, records, new Date()));
    showToast("已生成汇总");
  };

  const copySummary = async () => {
    if (!summaryData.text) {
      showToast("本周暂无工作记录");
      return;
    }

    try {
      await navigator.clipboard.writeText(summaryData.text);
      showToast("已复制");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "复制失败，请重试");
    }
  };

  if (loading) {
    return <div className="shell loading">正在加载插件数据...</div>;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>每日工作记录</h1>
          <p>{formatDateTitle(new Date())}</p>
        </div>
        <div className="topbar-logo" aria-label="志">
          志
        </div>
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
        {activeTab === "records" && (
          <section className="panel-stack">
            <section className="card hero-card">
              <div className="hero-row">
                <div>
                  <div className="section-label">今日记录</div>
                  <h2>{formatDateTitle(toDateFromKey(recordDateKey))}</h2>
                </div>
                <div className="hours-badge">{formatHoursWithUnit(recordHoursTotal)}</div>
              </div>
              <input
                type="date"
                className="input"
                value={recordDateKey}
                onChange={(event) => setRecordDateKey(event.target.value)}
              />
            </section>

            {enabledProjects.length === 0 ? (
              <section className="panel">
                <EmptyState
                  title="暂无可用项目"
                  description="请先到项目管理页新增并启用项目后，再登记工作内容。"
                  actionLabel="去配置项目"
                  onAction={() => setActiveTab("projects")}
                />
              </section>
            ) : (
              <RecordFormCard
                title={editingRecordId ? "编辑工作记录" : "新增工作记录"}
                draft={recordDraft}
                projects={recordFormProjects}
                saveLabel={editingRecordId ? "更新记录" : "保存记录"}
                onChange={setRecordDraft}
                onSave={() =>
                  void saveRecord(recordDateKey, recordDraft, editingRecordId, () => {
                    setEditingRecordId(null);
                    setRecordDraft(createEmptyRecordDraft());
                  })
                }
                onCancel={
                  editingRecordId
                    ? () => {
                        setEditingRecordId(null);
                        setRecordDraft(createEmptyRecordDraft());
                      }
                    : undefined
                }
              />
            )}

            <section className="panel">
              <div className="section-heading">
                <h3>当日记录</h3>
                <span>{selectedDateRecords.length} 条</span>
              </div>
              <RecordList
                records={selectedDateRecords}
                emptyTitle="当天暂无工作记录"
                emptyDescription="选择项目并填写工作事项后，保存即可出现在这里。"
                onEdit={(item) => {
                  setEditingRecordId(item.id);
                  setRecordDraft({
                    projectId: item.projectId,
                    content: item.content,
                    hours: `${item.hours}`,
                  });
                }}
                onDelete={(recordId) => void deleteRecord(recordDateKey, recordId)}
              />
            </section>
          </section>
        )}

        {activeTab === "projects" && (
          <section className="panel-stack">
            <section className="panel">
              <div className="section-heading">
                <h3>项目管理</h3>
                <span>停用项目不会出现在登记下拉框中</span>
              </div>
              <div className="project-list">
                {sortedProjects.length === 0 ? (
                  <EmptyState
                    title="暂无项目"
                    description="新增项目后即可在记录页快速选择并登记工作内容。"
                  />
                ) : (
                  sortedProjects.map((project) => (
                    <div key={project.id} className="project-card">
                      <div className="project-main">
                        <div className="project-title-wrap">
                          <div className="project-title">{formatProjectLabel(project.name, project.owner)}</div>
                          <span className={`project-status ${project.enabled ? "enabled" : "disabled"}`}>
                            {project.enabled ? "启用" : "停用"}
                          </span>
                        </div>
                        <div className="project-meta">
                          <span>负责人：{project.owner || "未填写"}</span>
                          <span>排序：{project.sortOrder ?? "未设置"}</span>
                        </div>
                      </div>
                      <div className="card-actions">
                        <button type="button" className="secondary-button" onClick={() => editProject(project)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="secondary-button danger"
                          onClick={() => void deleteProject(project.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h3>{editingProjectId ? "编辑项目" : "新增项目"}</h3>
                <span>{editingProjectId ? "修改后会影响后续新记录" : "历史记录保留项目快照"}</span>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>项目名称</span>
                  <input
                    type="text"
                    className="input"
                    value={projectDraft.name}
                    placeholder="请输入项目名称"
                    onChange={(event) =>
                      setProjectDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>负责人 / 标识</span>
                  <input
                    type="text"
                    className="input"
                    value={projectDraft.owner}
                    placeholder="例如：金伟"
                    onChange={(event) =>
                      setProjectDraft((current) => ({ ...current, owner: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>排序号</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input"
                    value={projectDraft.sortOrder}
                    placeholder="数字越小越靠前"
                    onChange={(event) =>
                      setProjectDraft((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                  />
                </label>
                <label className="switch-field">
                  <input
                    type="checkbox"
                    checked={projectDraft.enabled}
                    onChange={(event) =>
                      setProjectDraft((current) => ({ ...current, enabled: event.target.checked }))
                    }
                  />
                  <span>启用该项目</span>
                </label>
              </div>
              <div className="sticky-actions">
                <button type="button" className="primary-button" onClick={() => void saveProject()}>
                  {editingProjectId ? "保存修改" : "保存项目"}
                </button>
                {editingProjectId ? (
                  <button type="button" className="secondary-button" onClick={resetProjectEditor}>
                    取消编辑
                  </button>
                ) : null}
              </div>
            </section>
          </section>
        )}

        {activeTab === "history" && (
          <section className="panel-stack">
            <section className="panel">
              <div className="section-heading">
                <h3>历史记录</h3>
                <span>{formatDateTitle(toDateFromKey(historyDateKey))}</span>
              </div>
              <input
                type="date"
                className="input"
                value={historyDateKey}
                max={todayKey}
                onChange={(event) => setHistoryDateKey(event.target.value)}
              />
              <div className="filter-row">
                <button
                  type="button"
                  className={`pill-button ${historyRangeDays === 7 ? "active" : ""}`}
                  onClick={() => setHistoryRangeDays(7)}
                >
                  最近7天
                </button>
                <button
                  type="button"
                  className={`pill-button ${historyRangeDays === 30 ? "active" : ""}`}
                  onClick={() => setHistoryRangeDays(30)}
                >
                  最近30天
                </button>
              </div>
              <div className="shortcut-row">
                {historyQuickDates.map((dateKey) => (
                  <button
                    key={dateKey}
                    type="button"
                    className={`shortcut-button ${dateKey === historyDateKey ? "active" : ""}`}
                    onClick={() => setHistoryDateKey(dateKey)}
                  >
                    {dateKey.slice(5)}
                  </button>
                ))}
              </div>
            </section>

            <section className="stats-grid">
              <StatCard label="当日工时" value={formatHoursWithUnit(historyHoursTotal)} tone="primary" />
              <StatCard label="记录条数" value={`${historyRecords.length}`} />
              <StatCard
                label="日期"
                value={historyDateKey.slice(5)}
                tone={historyRecords.length > 0 ? "success" : "warning"}
              />
            </section>

            {editingHistoryRecordId ? (
              <RecordFormCard
                title="编辑历史记录"
                draft={historyDraft}
                projects={historyFormProjects}
                saveLabel="更新记录"
                onChange={setHistoryDraft}
                onSave={() =>
                  void saveRecord(historyDateKey, historyDraft, editingHistoryRecordId, () => {
                    setEditingHistoryRecordId(null);
                    setHistoryDraft(createEmptyRecordDraft());
                  })
                }
                onCancel={() => {
                  setEditingHistoryRecordId(null);
                  setHistoryDraft(createEmptyRecordDraft());
                }}
              />
            ) : null}

            <section className="panel">
              <div className="section-heading">
                <h3>历史列表</h3>
                <span>{historyRecords.length} 条</span>
              </div>
              <RecordList
                records={historyRecords}
                emptyTitle="该日期暂无记录"
                emptyDescription="可以切换到记录页为该日期补录工作内容。"
                onEdit={(item) => {
                  setEditingHistoryRecordId(item.id);
                  setHistoryDraft({
                    projectId: item.projectId,
                    content: item.content,
                    hours: `${item.hours}`,
                  });
                }}
                onDelete={(recordId) => void deleteRecord(historyDateKey, recordId)}
              />
            </section>
          </section>
        )}

        {activeTab === "summary" && (
          <section className="panel-stack">
            <section className="card hero-card">
              <div className="hero-row">
                <div>
                  <div className="section-label">周汇总</div>
                  <h2>{formatWeekRangeLabel(summaryData.weekRange.start, summaryData.weekRange.end)}</h2>
                </div>
                <div className="hours-badge">{formatHoursWithUnit(summaryData.totalHours)}</div>
              </div>
              <p className="hero-description">
                汇总按项目排序号升序分组，项目名称与负责人使用保存记录时的快照。
              </p>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h3>汇总操作</h3>
                <span>{summaryData.groups.length} 个项目分组</span>
              </div>
              <div className="sticky-actions">
                <button type="button" className="primary-button" onClick={refreshSummary}>
                  生成汇总
                </button>
                <button type="button" className="secondary-button" onClick={() => void copySummary()}>
                  复制汇总
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h3>汇总预览</h3>
                <span>支持滚动与全文选择</span>
              </div>
              {summaryData.text ? (
                <textarea className="summary-preview" readOnly value={summaryData.text} />
              ) : (
                <EmptyState
                  title="本周暂无工作记录"
                  description="保存工作记录后，会在这里自动生成按项目分组的周汇总文本。"
                />
              )}
            </section>
          </section>
        )}
      </main>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

interface RecordFormCardProps {
  title: string;
  draft: RecordDraft;
  projects: Project[];
  saveLabel: string;
  onChange: (draft: RecordDraft) => void;
  onSave: () => void;
  onCancel?: () => void;
}

function RecordFormCard({
  title,
  draft,
  projects,
  saveLabel,
  onChange,
  onSave,
  onCancel,
}: RecordFormCardProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h3>{title}</h3>
        <span>项目、事项、工时三步完成</span>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>所属项目</span>
          <select
            className="input"
            value={draft.projectId}
            onChange={(event) => onChange({ ...draft, projectId: event.target.value })}
          >
            <option value="">请选择项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {formatProjectLabel(project.name, project.owner)}
                {!project.enabled ? "（已停用）" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>工作事项</span>
          <textarea
            className="input textarea"
            value={draft.content}
            placeholder="请输入工作事项内容"
            onChange={(event) => onChange({ ...draft, content: event.target.value })}
          />
        </label>
        <label className="field">
          <span>工时</span>
          <div className="hours-input">
            <input
              type="text"
              inputMode="decimal"
              className="input"
              value={draft.hours}
              placeholder="例如 1.5"
              onChange={(event) => onChange({ ...draft, hours: event.target.value })}
            />
            <span>H</span>
          </div>
        </label>
      </div>
      <div className="sticky-actions">
        <button type="button" className="primary-button" onClick={onSave}>
          {saveLabel}
        </button>
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel}>
            取消
          </button>
        ) : null}
      </div>
    </section>
  );
}

interface RecordListProps {
  records: WorkRecord[];
  emptyTitle: string;
  emptyDescription: string;
  onEdit: (record: WorkRecord) => void;
  onDelete: (recordId: string) => void;
}

function RecordList({
  records,
  emptyTitle,
  emptyDescription,
  onEdit,
  onDelete,
}: RecordListProps) {
  if (records.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="record-list">
      {records.map((record) => (
        <article key={record.id} className="record-card">
          <div className="record-header">
            <div className="record-project">{formatProjectLabel(record.projectName, record.projectOwner)}</div>
            <div className="record-hours">{formatHoursWithUnit(record.hours)}</div>
          </div>
          <div className="record-content">{record.content}</div>
          <div className="record-footer">
            <span>更新于 {formatDateTimeLabel(record.updatedAt)}</span>
            <div className="card-actions">
              <button type="button" className="secondary-button" onClick={() => onEdit(record)}>
                编辑
              </button>
              <button
                type="button"
                className="secondary-button danger"
                onClick={() => onDelete(record.id)}
              >
                删除
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  tone?: "default" | "primary" | "success" | "warning";
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

function createEmptyProjectDraft(): ProjectDraft {
  return {
    name: "",
    owner: "",
    sortOrder: "",
    enabled: true,
  };
}

function createEmptyRecordDraft(): RecordDraft {
  return {
    projectId: "",
    content: "",
    hours: "",
  };
}

function formatProjectLabel(name: string, owner: string): string {
  return owner ? `${name}（${owner}）` : name;
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((left, right) => {
    const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

function sortRecordsNewestFirst(items: WorkRecord[]): WorkRecord[] {
  return [...items].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function sortRecordsOldestFirst(items: WorkRecord[]): WorkRecord[] {
  return [...items].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function sumHours(items: WorkRecord[]): number {
  return items.reduce((total, item) => total + item.hours, 0);
}

function getSelectableProjects(projects: Project[], currentRecord: WorkRecord | null): Project[] {
  const activeProjects = projects.filter((project) => project.enabled);

  if (!currentRecord || activeProjects.some((project) => project.id === currentRecord.projectId)) {
    return activeProjects;
  }

  return [
    {
      id: currentRecord.projectId,
      name: currentRecord.projectName,
      owner: currentRecord.projectOwner,
      sortOrder: null,
      enabled: false,
      createdAt: currentRecord.createdAt,
      updatedAt: currentRecord.updatedAt,
    },
    ...activeProjects,
  ];
}

function buildWeeklySummary(
  projects: Project[],
  records: WorkRecordsByDate,
  anchorDate: Date,
): WeeklySummary {
  const weekRange = getCurrentWeekRange(anchorDate);
  const projectOrder = new Map(sortProjects(projects).map((project, index) => [project.id, index]));
  const groupsMap = new Map<string, WeeklySummaryGroup>();

  Object.keys(records)
    .filter((dateKey) => dateKey >= weekRange.start && dateKey <= weekRange.end)
    .sort()
    .forEach((dateKey) => {
      sortRecordsOldestFirst(records[dateKey] ?? []).forEach((record) => {
        const existingGroup = groupsMap.get(record.projectId);

        if (existingGroup) {
          existingGroup.projectHours += record.hours;
          existingGroup.items.push({
            id: record.id,
            date: dateKey,
            content: record.content,
            hours: record.hours,
            createdAt: record.createdAt,
          });
          return;
        }

        groupsMap.set(record.projectId, {
          projectId: record.projectId,
          projectName: record.projectName,
          projectOwner: record.projectOwner,
          projectHours: record.hours,
          items: [
            {
              id: record.id,
              date: dateKey,
              content: record.content,
              hours: record.hours,
              createdAt: record.createdAt,
            },
          ],
        });
      });
    });

  const groups = [...groupsMap.values()].sort((left, right) => {
    const leftOrder = projectOrder.get(left.projectId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = projectOrder.get(right.projectId) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return new Date(left.items[0]?.createdAt ?? 0).getTime() - new Date(right.items[0]?.createdAt ?? 0).getTime();
  });

  const totalHours = groups.reduce((total, group) => total + group.projectHours, 0);
  const text = groups.length > 0 ? buildSummaryText(groups, totalHours) : "";

  return {
    weekRange,
    totalHours,
    groups,
    text,
  };
}

function buildSummaryText(groups: WeeklySummaryGroup[], totalHours: number): string {
  const lines: string[] = [`本周工作内容（总计：${formatHoursWithUnit(totalHours)}）`, ""];

  groups.forEach((group, groupIndex) => {
    const groupNo = groupIndex + 1;
    lines.push(
      `${groupNo}、${formatProjectLabel(group.projectName, group.projectOwner)}【${formatHoursWithUnit(group.projectHours)}】`,
    );

    group.items.forEach((item, itemIndex) => {
      lines.push(`${groupNo}.${itemIndex + 1}、${item.content}【${formatHoursWithUnit(item.hours)}】`);
    });

    if (groupIndex < groups.length - 1) {
      lines.push("");
    }
  });

  return lines.join("\n");
}

export default App;
