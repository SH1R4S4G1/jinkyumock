import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  CircleStop,
  LoaderCircle,
  Settings2,
  SquareTerminal,
} from "lucide-react";
import BrowserPanel from "./components/BrowserPanel";
import ConversationPanel from "./components/ConversationPanel";
import { RailMetric } from "./components/Controls";
import SettingsDrawer from "./components/SettingsDrawer";
import TracePanel from "./components/Timeline";
import {
  API_BASE,
  DEFAULT_TARGET_URL,
  formatDuration,
  INITIAL_SETTINGS,
  parseDomains,
  PROVIDERS,
  STATUS_LABELS,
} from "./config";

const ACTIVE_STATUSES = ["queued", "running", "stopping"];
const TERMINAL_STATUSES = ["completed", "failed", "stopped"];

function nowLabel() {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function createMessage(role, values = {}) {
  return {
    id: crypto.randomUUID(),
    role,
    time: nowLabel(),
    ...values,
  };
}

export default function App() {
  const [health, setHealth] = useState(null);
  const [connectionError, setConnectionError] = useState("");
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState(DEFAULT_TARGET_URL);
  const [urlDraft, setUrlDraft] = useState(DEFAULT_TARGET_URL);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("idle");
  const [steps, setSteps] = useState([]);
  const [result, setResult] = useState(null);
  const [browserState, setBrowserState] = useState({
    url: DEFAULT_TARGET_URL,
    title: "対象アプリケーション",
    screenshot: null,
    frame: null,
  });
  const [browserExpanded, setBrowserExpanded] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [copiedResult, setCopiedResult] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const startedAtRef = useRef(null);
  const eventSourceRef = useRef(null);
  const activeAssistantIdRef = useRef("");
  const latestErrorRef = useRef("");
  const traceScrollRef = useRef(null);

  const active = ACTIVE_STATUSES.includes(status);
  const completedSteps = steps.filter(
    (step) => step.status === "completed",
  ).length;
  const activeStep = steps.find((step) => step.status === "active");
  const statusLabel = STATUS_LABELS[status] || status;

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setHealth(await response.json());
      setConnectionError("");
    } catch {
      setHealth(null);
      setConnectionError("APIに接続できません");
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    const container = traceScrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [steps, result, status]);

  useEffect(
    () => () => {
      eventSourceRef.current?.close();
    },
    [],
  );

  function updateSettings(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function selectProvider(provider) {
    setSettings((current) => ({
      ...current,
      provider,
      model: PROVIDERS[provider].defaultModel,
    }));
  }

  function resetSettings() {
    setSettings({
      ...INITIAL_SETTINGS,
      allowedDomains: targetUrl,
    });
  }

  function updateAssistantMessage(values) {
    const assistantId = activeAssistantIdRef.current;
    if (!assistantId) return;
    setMessages((current) =>
      current.map((message) =>
        message.id === assistantId ? { ...message, ...values } : message,
      ),
    );
  }

  function handleEvent(event) {
    if (event.type === "status") {
      setStatus(event.status);
      if (event.status === "stopped") {
        updateAssistantMessage({ state: "stopped" });
      }
      if (event.status === "failed") {
        updateAssistantMessage({
          state: "failed",
          text: latestErrorRef.current || "実行に失敗しました。",
        });
      }
      if (TERMINAL_STATUSES.includes(event.status)) {
        eventSourceRef.current?.close();
      }
      return;
    }
    if (event.type === "browser") {
      if (event.url) {
        setUrlDraft(event.url);
      }
      setBrowserState({
        url: event.url || targetUrl,
        title: event.title || "対象アプリケーション",
        screenshot: event.screenshot || null,
        frame: event.frame || null,
      });
      return;
    }
    if (event.type === "step") {
      setSteps((current) => {
        const normalized = current.map((step) =>
          step.status === "active" ? { ...step, status: "completed" } : step,
        );
        const existing = normalized.findIndex(
          (step) => step.step === event.step,
        );
        if (existing >= 0) {
          const next = [...normalized];
          next[existing] = { ...next[existing], ...event };
          return next;
        }
        return [...normalized, event];
      });
      return;
    }
    if (event.type === "step_update") {
      setSteps((current) =>
        current.map((step) =>
          step.step === event.step
            ? { ...step, status: event.status }
            : step,
        ),
      );
      return;
    }
    if (event.type === "result") {
      setResult(event);
      updateAssistantMessage({
        state: "complete",
        result: event.result,
        text: event.result?.summary || "実行が完了しました。",
      });
      return;
    }
    if (event.type === "error") {
      latestErrorRef.current = event.message;
      setError(event.message);
      updateAssistantMessage({ state: "failed", text: event.message });
    }
  }

  async function sendInstruction(event) {
    event.preventDefault();
    const instruction = draft.trim();
    if (!instruction || active) return;

    eventSourceRef.current?.close();
    const userMessage = createMessage("user", { text: instruction });
    const assistantMessage = createMessage("assistant", { state: "running" });
    activeAssistantIdRef.current = assistantMessage.id;
    latestErrorRef.current = "";
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft("");
    setError("");
    setResult(null);
    setSteps([]);
    setRunId("");
    setElapsed(0);
    startedAtRef.current = Date.now();

    const payload = {
      target_url: targetUrl,
      task: instruction,
      allowed_domains: parseDomains(settings.allowedDomains),
      provider: settings.provider,
      model: settings.model.trim(),
      conversation_id: conversationId || null,
      headless: !settings.showBrowser,
      max_steps: Number(settings.maxSteps),
      safety: {
        prevent_writes: settings.preventWrites,
        prevent_sensitive_input: settings.preventSensitiveInput,
        prevent_downloads: settings.preventDownloads,
        require_final_verification: settings.requireFinalVerification,
      },
    };

    try {
      const response = await fetch(`${API_BASE}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail || "実行を開始できませんでした。");
      }

      setRunId(body.id);
      setConversationId(body.conversation_id);
      setStatus("queued");
      const source = new EventSource(
        `${API_BASE}/api/runs/${encodeURIComponent(body.id)}/events`,
      );
      eventSourceRef.current = source;
      source.onmessage = (message) => handleEvent(JSON.parse(message.data));
      source.onerror = () => {
        source.close();
        setStatus((current) =>
          TERMINAL_STATUSES.includes(current) ? current : "failed",
        );
        const message = "実行イベントの接続が切れました。";
        latestErrorRef.current = message;
        setError(message);
        updateAssistantMessage({ state: "failed", text: message });
      };
    } catch (runError) {
      latestErrorRef.current = runError.message;
      setStatus("failed");
      setError(runError.message);
      updateAssistantMessage({ state: "failed", text: runError.message });
    }
  }

  async function stopRun() {
    if (!runId) return;
    try {
      await fetch(
        `${API_BASE}/api/runs/${encodeURIComponent(runId)}/stop`,
        { method: "POST" },
      );
      setStatus("stopping");
    } catch {
      setError("停止要求を送信できませんでした。");
    }
  }

  async function closeConversation() {
    eventSourceRef.current?.close();
    if (conversationId) {
      await fetch(
        `${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}`,
        { method: "DELETE" },
      ).catch(() => {});
    }
  }

  async function startNewConversation() {
    if (active) return;
    await closeConversation();
    setConversationId("");
    setMessages([]);
    setSteps([]);
    setResult(null);
    setRunId("");
    setStatus("idle");
    setElapsed(0);
    setError("");
    setBrowserState({
      url: targetUrl,
      title: "対象アプリケーション",
      screenshot: null,
      frame: null,
    });
  }

  async function navigateTarget(event) {
    event.preventDefault();
    const nextUrl = urlDraft.trim();
    if (!nextUrl.startsWith("http://") && !nextUrl.startsWith("https://")) {
      setError("対象URLは http:// または https:// から入力してください。");
      return;
    }
    if (nextUrl === targetUrl) return;
    await closeConversation();
    setTargetUrl(nextUrl);
    setConversationId("");
    setMessages([]);
    setSteps([]);
    setResult(null);
    setRunId("");
    setStatus("idle");
    setElapsed(0);
    setError("");
    setSettings((current) => ({
      ...current,
      allowedDomains: nextUrl,
    }));
    setBrowserState({
      url: nextUrl,
      title: "対象アプリケーション",
      screenshot: null,
      frame: null,
    });
  }

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand("copy");
      textArea.remove();
      return copied;
    }
  }

  async function copyMessage(message) {
    const copied = await writeClipboard(
      JSON.stringify(message.result, null, 2),
    );
    if (!copied) return;
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId(""), 1600);
  }

  async function copyResult() {
    if (!result) return;
    const copied = await writeClipboard(
      JSON.stringify(result.result, null, 2),
    );
    if (!copied) return;
    setCopiedResult(true);
    window.setTimeout(() => setCopiedResult(false), 1600);
  }

  function downloadLog() {
    const output = {
      conversation_id: conversationId,
      run_id: runId,
      status,
      target_url: targetUrl,
      messages,
      steps,
      result,
    };
    const blob = new Blob([JSON.stringify(output, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agent-run-${runId || "draft"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <SquareTerminal size={20} strokeWidth={1.9} />
          </div>
          <span>Agent Console</span>
        </div>
        <div className="topbar-actions">
          <button
            className={`connection-chip ${health ? "connected" : "disconnected"}`}
            type="button"
            title={connectionError || "API接続は正常です"}
            onClick={loadHealth}
          >
            <span className="status-dot" />
            {health ? "API 接続済み" : "API 未接続"}
          </button>
          <div className="model-chip">
            <Bot size={15} />
            {PROVIDERS[settings.provider].label} / {settings.model}
          </div>
          <button
            className="settings-button"
            type="button"
            aria-label="設定"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={17} />
            設定
          </button>
        </div>
      </header>

      <main
        className={`workbench ${browserExpanded ? "browser-expanded" : ""}`}
      >
        <ConversationPanel
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          active={active}
          status={statusLabel}
          error={error}
          onSubmit={sendInstruction}
          onNewConversation={startNewConversation}
          copiedId={copiedMessageId}
          onCopy={copyMessage}
        />
        <BrowserPanel
          targetUrl={targetUrl}
          urlDraft={urlDraft}
          setUrlDraft={setUrlDraft}
          onNavigate={navigateTarget}
          browserState={browserState}
          activeStep={activeStep}
          active={active}
          expanded={browserExpanded}
          onToggleExpand={() => setBrowserExpanded((current) => !current)}
        />
        <TracePanel
          steps={steps}
          result={result}
          status={status}
          error={error}
          onCopy={copyResult}
          onDownload={downloadLog}
          copied={copiedResult}
          scrollRef={traceScrollRef}
        />

        <footer className="run-rail">
          <RailMetric label="経過時間" value={formatDuration(elapsed)} />
          <RailMetric
            label="ステップ"
            value={`${completedSteps}${active ? ` / ${settings.maxSteps}` : ""}`}
          />
          <RailMetric label="実行ID" value={runId || "未実行"} monospace />
          <RailMetric label="状態" value={statusLabel} />
          <div className="rail-trace">
            <span className={`trace-dot ${active ? "recording" : ""}`} />
            トレース記録
          </div>
          <button
            className="stop-button"
            type="button"
            onClick={stopRun}
            disabled={!active || status === "stopping"}
          >
            {status === "stopping" ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <CircleStop size={17} />
            )}
            実行を停止
          </button>
        </footer>
      </main>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        updateSettings={updateSettings}
        selectProvider={selectProvider}
        health={health}
        active={active}
        onReset={resetSettings}
      />
    </div>
  );
}
