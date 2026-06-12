import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  ChevronDown,
  ChevronUp,
  CircleStop,
  Earth,
  Expand,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Monitor,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SquareTerminal,
  X,
} from "lucide-react";
import {
  API_BASE,
  formatDuration,
  INITIAL_FORM,
  parseDomains,
  PROVIDERS,
  SCENARIOS,
  STAGES,
  STATUS_LABELS,
} from "./config";
import {
  CheckControl,
  EnvironmentRow,
  RadioControl,
  RailMetric,
} from "./components/Controls";
import { ResultPanel, TimelineItem } from "./components/Timeline";

const ACTIVE_STATUSES = ["queued", "running", "stopping"];
const TERMINAL_STATUSES = ["completed", "failed", "stopped"];

export default function App() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [health, setHealth] = useState(null);
  const [connectionError, setConnectionError] = useState("");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("idle");
  const [steps, setSteps] = useState([]);
  const [result, setResult] = useState(null);
  const [browserState, setBrowserState] = useState({
    url: INITIAL_FORM.targetUrl,
    title: "対象アプリケーション",
    screenshot: null,
  });
  const [browserView, setBrowserView] = useState("live");
  const [composerOpen, setComposerOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [browserExpanded, setBrowserExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const startedAtRef = useRef(null);
  const eventSourceRef = useRef(null);

  const active = ACTIVE_STATUSES.includes(status);
  const completedSteps = steps.filter(
    (step) => step.status === "completed",
  ).length;
  const activeStep = steps.find((step) => step.status === "active");

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

  useEffect(
    () => () => {
      eventSourceRef.current?.close();
    },
    [],
  );

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectScenario(scenario) {
    const selection = SCENARIOS[scenario];
    setForm((current) => ({
      ...current,
      scenario,
      task: scenario === "blank" ? current.task : selection.task,
    }));
  }

  function selectProvider(provider) {
    setForm((current) => ({
      ...current,
      provider,
      model: PROVIDERS[provider].defaultModel,
    }));
  }

  function toggleBrowserExpand() {
    setBrowserExpanded((current) => {
      const next = !current;
      setComposerOpen(!next);
      setTimelineOpen(!next);
      return next;
    });
  }

  function handleEvent(event) {
    if (event.type === "status") {
      setStatus(event.status);
      if (TERMINAL_STATUSES.includes(event.status)) {
        eventSourceRef.current?.close();
      }
      return;
    }
    if (event.type === "browser") {
      setBrowserState({
        url: event.url || form.targetUrl,
        title: event.title || "対象アプリケーション",
        screenshot: event.screenshot || null,
      });
      if (event.screenshot) setBrowserView("screenshot");
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
      return;
    }
    if (event.type === "error") setError(event.message);
  }

  async function startRun(event) {
    event.preventDefault();
    eventSourceRef.current?.close();
    setError("");
    setResult(null);
    setSteps([]);
    setRunId("");
    setElapsed(0);
    setBrowserState({
      url: form.targetUrl,
      title: "対象アプリケーション",
      screenshot: null,
    });

    const payload = {
      target_url: form.targetUrl.trim(),
      task: form.task.trim(),
      allowed_domains: parseDomains(form.allowedDomains),
      provider: form.provider,
      model: form.model.trim(),
      execution_mode: form.executionMode,
      headless: form.headless,
      max_steps: Number(form.maxSteps),
      safety: {
        prevent_writes: form.preventWrites,
        prevent_sensitive_input: form.preventSensitiveInput,
        prevent_downloads: form.preventDownloads,
        require_final_verification: form.requireFinalVerification,
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
      setStatus("queued");
      startedAtRef.current = Date.now();
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
        setError((current) => current || "実行イベントの接続が切れました。");
      };
    } catch (runError) {
      setStatus("failed");
      setError(runError.message);
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

  async function copyResult() {
    if (!result) return;
    const text = JSON.stringify(result.result, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copiedWithFallback = document.execCommand("copy");
      textArea.remove();
      if (!copiedWithFallback) {
        setError("クリップボードへコピーできませんでした。");
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadLog() {
    const output = {
      run_id: runId,
      status,
      request: {
        target_url: form.targetUrl,
        task: form.task,
        allowed_domains: parseDomains(form.allowedDomains),
        provider: form.provider,
        model: form.model,
      },
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

  const statusLabel = useMemo(
    () => STATUS_LABELS[status] || status,
    [status],
  );
  const workbenchClass = [
    "workbench",
    composerOpen ? "" : "composer-collapsed",
    timelineOpen ? "" : "timeline-collapsed",
    browserExpanded ? "browser-expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
            {PROVIDERS[form.provider].label} / {form.model}
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="設定"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((current) => !current)}
          >
            <Settings2 size={18} />
          </button>
          {settingsOpen && (
            <section className="environment-popover">
              <div className="environment-heading">
                <div>
                  <span>実行環境</span>
                  <strong>接続とプロバイダー</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="設定を閉じる"
                >
                  <X size={16} />
                </button>
              </div>
              <EnvironmentRow
                label="デモ再生"
                available={health?.demo_available !== false}
                detail="APIキー不要"
              />
              <EnvironmentRow
                label="Browser Use"
                available={Boolean(health?.browser_use_available)}
                detail={
                  health?.browser_use_available
                    ? "実ブラウザ実行可能"
                    : "live extraが必要"
                }
              />
              {Object.entries(PROVIDERS).map(([key, provider]) => (
                <EnvironmentRow
                  key={key}
                  label={provider.label}
                  available={Boolean(health?.providers?.[key])}
                  detail={
                    health?.providers?.[key] ? "APIキー設定済み" : "未設定"
                  }
                />
              ))}
            </section>
          )}
        </div>
      </header>

      <main className={workbenchClass}>
        <aside className="composer">
          <div className="panel-title">
            <div>
              <span className="panel-kicker">RUN CONFIGURATION</span>
              <h1>指示</h1>
            </div>
            <button
              className="plain-icon"
              type="button"
              onClick={() => setComposerOpen((current) => !current)}
              aria-label={
                composerOpen ? "指示パネルを閉じる" : "指示パネルを開く"
              }
            >
              {composerOpen ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </button>
          </div>

          {composerOpen && (
            <form className="composer-form" onSubmit={startRun}>
              <label className="control-group">
                <span>対象URL</span>
                <div className="input-with-icon">
                  <Earth size={16} />
                  <input
                    value={form.targetUrl}
                    onChange={(event) =>
                      updateForm("targetUrl", event.target.value)
                    }
                    placeholder="https://legacy.example.com"
                    required
                    disabled={active}
                  />
                </div>
              </label>

              <label className="control-group task-control">
                <span>実行内容</span>
                <textarea
                  value={form.task}
                  onChange={(event) => updateForm("task", event.target.value)}
                  placeholder="エージェントに実行してほしい操作を自然言語で入力"
                  required
                  disabled={active}
                />
                <small>
                  {form.task.length.toLocaleString("ja-JP")} / 20,000
                </small>
              </label>

              <fieldset className="safety-fieldset" disabled={active}>
                <legend>
                  安全条件
                  <ShieldCheck size={15} />
                </legend>
                <CheckControl
                  label="データの変更を行わない"
                  checked={form.preventWrites}
                  onChange={(value) => updateForm("preventWrites", value)}
                />
                <CheckControl
                  label="機密情報を入力しない"
                  checked={form.preventSensitiveInput}
                  onChange={(value) =>
                    updateForm("preventSensitiveInput", value)
                  }
                />
                <CheckControl
                  label="ファイルをダウンロードしない"
                  checked={form.preventDownloads}
                  onChange={(value) => updateForm("preventDownloads", value)}
                />
                <CheckControl
                  label="終了前に結果を再検証する"
                  checked={form.requireFinalVerification}
                  onChange={(value) =>
                    updateForm("requireFinalVerification", value)
                  }
                />
              </fieldset>

              <label className="control-group">
                <span>許可ドメイン</span>
                <div className="input-with-icon domain-input">
                  <LockKeyhole size={16} />
                  <input
                    value={form.allowedDomains}
                    onChange={(event) =>
                      updateForm("allowedDomains", event.target.value)
                    }
                    placeholder="example.com, *.internal.example.com"
                    required
                    disabled={active}
                  />
                </div>
                <small>カンマ区切り。ポートを含むURLも指定できます。</small>
              </label>

              <div className="two-column-controls">
                <label className="control-group">
                  <span>シナリオ</span>
                  <select
                    value={form.scenario}
                    onChange={(event) => selectScenario(event.target.value)}
                    disabled={active}
                  >
                    {Object.entries(SCENARIOS).map(([key, scenario]) => (
                      <option value={key} key={key}>
                        {scenario.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="control-group">
                  <span>最大ステップ</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.maxSteps}
                    onChange={(event) =>
                      updateForm("maxSteps", event.target.value)
                    }
                    disabled={active}
                  />
                </label>
              </div>

              <div className="two-column-controls">
                <label className="control-group">
                  <span>プロバイダー</span>
                  <select
                    value={form.provider}
                    onChange={(event) => selectProvider(event.target.value)}
                    disabled={active}
                  >
                    {Object.entries(PROVIDERS).map(([key, provider]) => (
                      <option value={key} key={key}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="control-group">
                  <span>モデル</span>
                  <input
                    value={form.model}
                    onChange={(event) => updateForm("model", event.target.value)}
                    disabled={active}
                  />
                </label>
              </div>

              <fieldset className="mode-fieldset" disabled={active}>
                <legend>実行モード</legend>
                <RadioControl
                  label="デモ再生"
                  description="APIキー不要"
                  checked={form.executionMode === "demo"}
                  onChange={() => updateForm("executionMode", "demo")}
                />
                <RadioControl
                  label="実ブラウザ"
                  description={
                    health?.browser_use_available
                      ? "Browser Use"
                      : "未セットアップ"
                  }
                  checked={form.executionMode === "live"}
                  onChange={() => updateForm("executionMode", "live")}
                />
              </fieldset>

              <label className="headless-toggle">
                <span>
                  <Monitor size={16} />
                  ブラウザを画面に表示
                </span>
                <input
                  type="checkbox"
                  checked={!form.headless}
                  onChange={(event) =>
                    updateForm("headless", !event.target.checked)
                  }
                  disabled={active || form.executionMode === "demo"}
                />
                <span className="switch" />
              </label>

              {error && (
                <div className="inline-alert" role="alert">
                  <X size={15} />
                  {error}
                </div>
              )}

              <button
                className="primary-button"
                type="submit"
                disabled={active}
              >
                {active ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
                {active ? statusLabel : "実行を開始"}
              </button>
            </form>
          )}
        </aside>

        <section className="browser-panel">
          <div className="panel-title browser-title">
            <div>
              <span className="panel-kicker">TARGET APPLICATION</span>
              <h2>ライブブラウザ</h2>
            </div>
            <button
              className="plain-icon"
              type="button"
              onClick={toggleBrowserExpand}
              aria-label={
                browserExpanded
                  ? "ブラウザ表示を元に戻す"
                  : "ブラウザ表示を拡大"
              }
            >
              <Expand size={18} />
            </button>
          </div>

          <div className="browser-toolbar">
            <div className="browser-navigation">
              <button type="button" disabled aria-label="戻る">
                <ArrowLeft size={16} />
              </button>
              <button type="button" disabled aria-label="進む">
                <ArrowRight size={16} />
              </button>
              <button type="button" disabled aria-label="再読み込み">
                <RefreshCw size={15} />
              </button>
            </div>
            <div className="address-bar" title={browserState.url}>
              <Globe2 size={14} />
              <span>{browserState.url}</span>
            </div>
            <div className="view-switcher">
              <button
                className={browserView === "screenshot" ? "active" : ""}
                type="button"
                onClick={() => setBrowserView("screenshot")}
                disabled={!browserState.screenshot}
              >
                スクリーンショット
              </button>
              <button
                className={browserView === "live" ? "active" : ""}
                type="button"
                onClick={() => setBrowserView("live")}
              >
                ライブ
              </button>
            </div>
          </div>

          <div className="browser-canvas">
            {browserView === "screenshot" && browserState.screenshot ? (
              <img
                className="browser-screenshot"
                src={`data:image/png;base64,${browserState.screenshot}`}
                alt={`${browserState.title}のエージェント観察画面`}
              />
            ) : (
              <>
                <iframe
                  title="対象アプリケーションのライブプレビュー"
                  src={form.targetUrl}
                  sandbox="allow-forms allow-modals allow-same-origin allow-scripts"
                />
                <div className="preview-note">
                  <Earth size={14} />
                  埋め込みを許可しないサイトでは、実行中のスクリーンショットを表示します。
                </div>
              </>
            )}
            {activeStep && (
              <div className="active-operation">
                <span className="operation-pulse" />
                {activeStep.label}: {activeStep.title}
              </div>
            )}
          </div>
        </section>

        <aside className="timeline-panel">
          <div className="panel-title">
            <div>
              <span className="panel-kicker">AGENT TRACE</span>
              <h2>エージェントの進行</h2>
            </div>
            <button
              className="plain-icon"
              type="button"
              onClick={() => setTimelineOpen((current) => !current)}
              aria-label={
                timelineOpen ? "進行パネルを閉じる" : "進行パネルを開く"
              }
            >
              {timelineOpen ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </button>
          </div>

          {timelineOpen && (
            <div className="timeline-content">
              <div className="timeline">
                {steps.length === 0
                  ? Object.entries(STAGES).map(([key, stage], index) => (
                      <TimelineItem
                        key={key}
                        item={{
                          step: index + 1,
                          stage: key,
                          label: stage.label,
                          title:
                            index === 0 ? "実行待ち" : `${stage.label}ステップ`,
                          detail:
                            index === 0
                              ? "指示を入力して実行を開始してください。"
                              : "前のステップが完了すると開始します。",
                          status: "pending",
                        }}
                      />
                    ))
                  : steps.map((step) => (
                      <TimelineItem
                        key={`${step.step}-${step.stage}`}
                        item={step}
                      />
                    ))}
              </div>
              <ResultPanel
                result={result}
                status={status}
                error={error}
                onCopy={copyResult}
                onDownload={downloadLog}
                copied={copied}
              />
            </div>
          )}
        </aside>

        <footer className="run-rail">
          <RailMetric label="経過時間" value={formatDuration(elapsed)} />
          <RailMetric
            label="ステップ"
            value={`${completedSteps}${active ? ` / ${form.maxSteps}` : ""}`}
          />
          <RailMetric label="実行ID" value={runId || "未実行"} monospace />
          <RailMetric label="状態" value={statusLabel} />
          <div className="rail-trace">
            <span className={`trace-dot ${active ? "recording" : ""}`} />
            {form.executionMode === "live" ? "トレース記録" : "デモイベント"}
          </div>
          <button
            className="stop-button"
            type="button"
            onClick={stopRun}
            disabled={!active || status === "stopping"}
          >
            <CircleStop size={17} />
            実行を停止
          </button>
        </footer>
      </main>
    </div>
  );
}
