import {
  Check,
  CircleStop,
  Clipboard,
  Download,
  FileBraces,
  LoaderCircle,
  X,
} from "lucide-react";
import { displayEntries, STAGES } from "../config";

export function TimelineItem({ item }) {
  const stage = STAGES[item.stage] || STAGES.observation;
  const Icon = stage.icon;
  const stateLabel =
    item.status === "active"
      ? "実行中"
      : item.status === "completed"
        ? "完了"
        : "待機中";

  return (
    <article className={`timeline-item ${item.status || "pending"}`}>
      <div className="timeline-marker">
        {item.status === "completed" ? (
          <Check size={13} />
        ) : item.status === "active" ? (
          <span className="marker-pulse" />
        ) : (
          <Icon size={13} />
        )}
      </div>
      <div className="timeline-copy">
        <div className="timeline-heading">
          <strong>{item.label || stage.label}</strong>
          <span>{stateLabel}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.detail}</p>
        {item.actions?.length > 0 && (
          <code>{JSON.stringify(item.actions[0])}</code>
        )}
      </div>
    </article>
  );
}

function EvidencePanel({
  result,
  status,
  error,
  onCopy,
  onDownload,
  copied,
}) {
  const entries = displayEntries(result?.result).filter(
    ([key]) => key !== "summary",
  );
  const complete = status === "completed" && result;
  const stopped = status === "stopped";
  const failed = status === "failed";
  const StatusIcon = complete
    ? Check
    : stopped
      ? CircleStop
      : failed
        ? X
        : LoaderCircle;

  return (
    <section
      className={`evidence-panel ${complete ? "complete" : ""} ${failed ? "failed" : ""}`}
    >
      <div className="evidence-heading">
        <div>
          <span>結果</span>
          <h2>
            {complete
              ? "検証が完了しました"
              : stopped
                ? "実行を停止しました"
                : failed
                  ? "実行に失敗しました"
                  : "結果を待機しています"}
          </h2>
        </div>
        <div className="evidence-status">
          <StatusIcon size={14} />
          {complete
            ? "完了"
            : stopped
              ? "停止済み"
              : failed
                ? "失敗"
                : "待機"}
        </div>
      </div>

      {complete ? (
        <>
          <p className="evidence-summary">{result.result?.summary}</p>
          {entries.length > 0 && (
            <dl className="evidence-data">
              {entries.map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replaceAll("_", " ")}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="evidence-actions">
            <button type="button" onClick={onCopy}>
              {copied ? <Check size={15} /> : <Clipboard size={15} />}
              {copied ? "コピー済み" : "JSONをコピー"}
            </button>
            <button type="button" onClick={onDownload}>
              <Download size={15} />
              実行ログ
            </button>
          </div>
        </>
      ) : (
        <div className="evidence-empty">
          {stopped ? (
            <CircleStop size={22} />
          ) : failed ? (
            <X size={22} />
          ) : (
            <FileBraces size={22} />
          )}
          <p>
            {failed
              ? error || "実行ログを確認してください。"
              : stopped
                ? "ブラウザセッションは会話内に保持されています。"
                : "実行が完了すると検証結果を表示します。"}
          </p>
        </div>
      )}
    </section>
  );
}

export default function TracePanel({
  steps,
  result,
  status,
  error,
  onCopy,
  onDownload,
  copied,
  scrollRef,
}) {
  return (
    <aside className="trace-panel">
      <div className="panel-heading">
        <h2>エージェントの進行</h2>
      </div>
      <div className="trace-scroll" ref={scrollRef}>
        <div className="timeline">
          {steps.length === 0 ? (
            <div className="trace-empty">
              <FileBraces size={24} />
              <strong>実行トレースはここに表示されます</strong>
              <p>計画、観察、操作、検証をステップごとに確認できます。</p>
            </div>
          ) : (
            steps.map((step) => (
              <TimelineItem
                key={`${step.step}-${step.stage}`}
                item={step}
              />
            ))
          )}
        </div>
        <EvidencePanel
          result={result}
          status={status}
          error={error}
          onCopy={onCopy}
          onDownload={onDownload}
          copied={copied}
        />
      </div>
    </aside>
  );
}

