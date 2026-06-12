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
        {item.actions?.length > 0 && <code>{JSON.stringify(item.actions[0])}</code>}
      </div>
    </article>
  );
}

export function ResultPanel({
  result,
  status,
  error,
  onCopy,
  onDownload,
  copied,
}) {
  const entries = displayEntries(result?.result);
  const complete = status === "completed" && result;
  const stopped = status === "stopped";
  const failed = status === "failed";
  const emptyState = stopped
    ? {
        heading: "実行を停止しました",
        badge: "停止済み",
        detail: "停止要求を受け付け、安全に実行を終了しました。",
      }
    : failed
      ? {
          heading: "実行に失敗しました",
          badge: "失敗",
          detail: error || "実行ログを確認してください。",
        }
      : {
          heading: "結果を待機しています",
          badge: "待機",
          detail:
            "検証ステップが完了すると、要約と抽出データを表示します。",
        };

  const StatusIcon = complete
    ? Check
    : stopped
      ? CircleStop
      : failed
        ? X
        : LoaderCircle;
  const EmptyIcon = stopped ? CircleStop : failed ? X : FileBraces;

  return (
    <section
      className={`result-panel ${complete ? "complete" : ""} ${failed ? "failed" : ""}`}
    >
      <div className="result-heading">
        <div>
          <span>実行結果</span>
          <h2>{complete ? "検証が完了しました" : emptyState.heading}</h2>
        </div>
        <div className="result-status">
          <StatusIcon size={14} />
          {complete ? "完了" : emptyState.badge}
        </div>
      </div>

      {complete ? (
        <>
          <p className="result-summary">
            {result.result?.summary || "実行結果を取得しました。"}
          </p>
          {entries.length > 0 && (
            <dl className="result-data">
              {entries.map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replaceAll("_", " ")}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
          {result.result?.note && (
            <div className="result-note">{result.result.note}</div>
          )}
          <div className="result-actions">
            <button type="button" onClick={onCopy}>
              {copied ? <Check size={16} /> : <Clipboard size={16} />}
              {copied ? "コピー済み" : "JSONをコピー"}
            </button>
            <button type="button" onClick={onDownload}>
              <Download size={16} />
              実行ログを保存
            </button>
          </div>
        </>
      ) : (
        <div className="result-empty">
          <EmptyIcon size={24} />
          <p>{emptyState.detail}</p>
        </div>
      )}
    </section>
  );
}

