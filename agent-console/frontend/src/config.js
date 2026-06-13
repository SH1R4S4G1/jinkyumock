import { Eye, MousePointerClick, ShieldCheck, Sparkles } from "lucide-react";

export const API_BASE = import.meta.env.VITE_API_BASE || "";
export const DEFAULT_TARGET_URL =
  import.meta.env.VITE_DEFAULT_TARGET_URL || "http://127.0.0.1:4173";

export const PROVIDERS = {
  google: {
    label: "Google",
    defaultModel: "gemini-2.5-flash",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4.1-mini",
  },
  anthropic: {
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-20250514",
  },
  "browser-use": {
    label: "Browser Use",
    defaultModel: "bu-2-0",
  },
};

export const INITIAL_SETTINGS = {
  allowedDomains: DEFAULT_TARGET_URL,
  provider: "google",
  model: PROVIDERS.google.defaultModel,
  showBrowser: false,
  maxSteps: 30,
  preventWrites: true,
  preventSensitiveInput: true,
  preventDownloads: true,
  requireFinalVerification: true,
};

export const STAGES = {
  planning: { label: "計画", icon: Sparkles },
  observation: { label: "観察", icon: Eye },
  action: { label: "操作", icon: MousePointerClick },
  verification: { label: "検証", icon: ShieldCheck },
};

export const STATUS_LABELS = {
  idle: "待機中",
  queued: "開始中",
  running: "実行中",
  stopping: "停止中",
  stopped: "停止済み",
  failed: "失敗",
  completed: "完了",
};

export function parseDomains(value) {
  return value
    .split(/[\n,]/)
    .map((domain) => domain.trim())
    .filter(Boolean);
}

export function formatDuration(value) {
  const seconds = Math.max(0, Math.floor(value));
  return [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function displayEntries(value) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value)
    .filter(([, item]) => ["string", "number", "boolean"].includes(typeof item))
    .slice(0, 7);
}

export function screenshotSource(value) {
  if (!value) return "";
  return value.startsWith("data:")
    ? value
    : `data:image/png;base64,${value}`;
}

