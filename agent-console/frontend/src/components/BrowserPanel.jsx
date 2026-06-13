import {
  ArrowLeft,
  ArrowRight,
  Expand,
  ExternalLink,
  Globe2,
  RefreshCw,
} from "lucide-react";
import { screenshotSource } from "../config";

export default function BrowserPanel({
  targetUrl,
  urlDraft,
  setUrlDraft,
  onNavigate,
  browserState,
  activeStep,
  active,
  expanded,
  onToggleExpand,
}) {
  const captured = Boolean(browserState.screenshot);

  return (
    <section className="browser-panel">
      <div className="panel-heading">
        <h2>ブラウザ</h2>
        <button
          className="icon-button-light"
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? "ブラウザ表示を元に戻す" : "ブラウザ表示を拡大"}
        >
          <Expand size={17} />
        </button>
      </div>

      <form className="browser-toolbar" onSubmit={onNavigate}>
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
        <label className="address-input">
          <Globe2 size={14} />
          <input
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            disabled={active}
            aria-label="対象URL"
          />
        </label>
        <button className="open-button" type="submit" disabled={active}>
          開く
          <ExternalLink size={14} />
        </button>
      </form>

      <div className="browser-canvas">
        {captured ? (
          <img
            className="browser-screenshot"
            src={screenshotSource(browserState.screenshot)}
            alt={`${browserState.title}の最新取得画面`}
          />
        ) : (
          <iframe
            title="対象アプリケーションのプレビュー"
            src={targetUrl}
            sandbox="allow-forms allow-modals allow-same-origin allow-scripts"
          />
        )}
        <div className={`capture-indicator ${captured ? "captured" : ""}`}>
          <span className={active ? "operation-pulse" : ""} />
          {captured
            ? `エージェント取得画面${browserState.frame ? ` / ステップ ${browserState.frame}` : ""}`
            : "実行前プレビュー"}
        </div>
        {activeStep && (
          <div className="active-operation">
            <span className="operation-pulse" />
            {activeStep.title}
          </div>
        )}
      </div>
    </section>
  );
}

