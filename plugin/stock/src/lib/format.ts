import type { RiskLevel } from "../types";

export function formatMoney(value: number): string {
  return `¥${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatSignedMoney(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatMoney(value)}`;
}

export function formatCompactNumber(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`;
  }

  if (value >= 10000) {
    return `${(value / 10000).toFixed(2)}万`;
  }

  return `${Math.round(value)}`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function riskLevelLabel(level: RiskLevel): string {
  if (level === "low") {
    return "低风险";
  }

  if (level === "medium") {
    return "中风险";
  }

  return "高风险";
}

export function riskLevelTone(level: RiskLevel): string {
  if (level === "low") {
    return "low";
  }

  if (level === "medium") {
    return "medium";
  }

  return "high";
}
