import {
  Eye,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const API_BASE = import.meta.env.VITE_API_BASE || "";
export const DEFAULT_TARGET_URL =
  import.meta.env.VITE_DEFAULT_TARGET_URL || "http://127.0.0.1:4173";

export const SCENARIOS = {
  blank: {
    label: "自由入力",
    task: "",
  },
  lookup: {
    label: "検索・参照",
    task: `対象URLを開いてください。
ログイン画面があれば、PoC用のユーザーでログインしてください。
指定された検索画面を開き、条件に合うレコードを検索してください。
検索結果の先頭を開き、必要な項目を読み取ってください。
最後に、実行した操作、読み取った値、確認方法を要約してください。
本番データや許可されていない外部サイトには移動しないでください。`,
  },
  update: {
    label: "更新・再検証",
    task: `対象URLを開き、PoC用のユーザーでログインしてください。
指定されたレコードを検索し、現在値を確認してから指示された項目だけを更新してください。
更新後は参照画面を開き直し、変更結果を再確認してください。
最後に、変更前後の値、実行した操作、検証結果を要約してください。`,
  },
  report: {
    label: "帳票・一覧確認",
    task: `対象URLを開き、指定された期間と条件で一覧を表示してください。
件数、ステータス、主要な集計値を読み取ってください。
データの更新や削除は行わず、画面上で確認できた事実だけを報告してください。`,
  },
};

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

export const INITIAL_FORM = {
  targetUrl: DEFAULT_TARGET_URL,
  task: SCENARIOS.lookup.task,
  allowedDomains: DEFAULT_TARGET_URL,
  scenario: "lookup",
  provider: "google",
  model: PROVIDERS.google.defaultModel,
  executionMode: "demo",
  headless: true,
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

