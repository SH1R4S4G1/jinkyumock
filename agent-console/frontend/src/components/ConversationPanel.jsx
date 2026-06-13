import { useEffect, useRef } from "react";
import {
  Bot,
  Check,
  CircleStop,
  Clipboard,
  LoaderCircle,
  Plus,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { displayEntries } from "../config";

function MessageAvatar({ role }) {
  return (
    <div className={`message-avatar ${role}`}>
      {role === "user" ? <UserRound size={15} /> : <Bot size={16} />}
    </div>
  );
}

function AssistantResult({ message, copiedId, onCopy }) {
  const entries = displayEntries(message.result);
  return (
    <div className="assistant-result">
      <p>{message.result?.summary || message.text}</p>
      {entries.length > 0 && (
        <dl>
          {entries
            .filter(([key]) => key !== "summary")
            .map(([key, value]) => (
              <div key={key}>
                <dt>{key.replaceAll("_", " ")}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
        </dl>
      )}
      <div className="assistant-result-footer">
        <span>
          <Check size={13} />
          画面と実行履歴で検証済み
        </span>
        <button type="button" onClick={() => onCopy(message)}>
          {copiedId === message.id ? (
            <Check size={14} />
          ) : (
            <Clipboard size={14} />
          )}
          {copiedId === message.id ? "コピー済み" : "回答をコピー"}
        </button>
      </div>
    </div>
  );
}

export default function ConversationPanel({
  messages,
  draft,
  setDraft,
  active,
  status,
  error,
  onSubmit,
  onNewConversation,
  copiedId,
  onCopy,
}) {
  const hasMessages = messages.length > 0;
  const feedRef = useRef(null);
  const composingRef = useRef(false);

  useEffect(() => {
    const feed = feedRef.current;
    if (feed) {
      feed.scrollTop = feed.scrollHeight;
    }
  }, [messages]);

  function handleKeyDown(event) {
    if (
      composingRef.current ||
      event.nativeEvent?.isComposing ||
      event.keyCode === 229
    ) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <aside className="conversation-panel">
      <div className="panel-heading conversation-heading">
        <h1>会話</h1>
        <button
          className="secondary-button compact"
          type="button"
          onClick={onNewConversation}
          disabled={active || !hasMessages}
        >
          <Plus size={15} />
          新しい会話
        </button>
      </div>

      <div
        className={`conversation-feed ${hasMessages ? "" : "empty"}`}
        ref={feedRef}
      >
        {!hasMessages && (
          <div className="conversation-empty">
            <Bot size={26} />
            <strong>ブラウザ操作を指示してください</strong>
            <p>
              中央のURLを確認し、検索・参照・更新・検証などを自然言語で依頼できます。
            </p>
          </div>
        )}
        {messages.map((message) => (
          <article className={`chat-message ${message.role}`} key={message.id}>
            <MessageAvatar role={message.role} />
            <div className="message-body">
              <div className="message-meta">
                <strong>{message.role === "user" ? "あなた" : "エージェント"}</strong>
                <span>{message.time}</span>
              </div>
              {message.state === "running" ? (
                <div className="assistant-thinking">
                  <LoaderCircle className="spin" size={15} />
                  ブラウザを操作しています
                </div>
              ) : message.state === "failed" ? (
                <div className="assistant-error">
                  <X size={15} />
                  {message.text}
                </div>
              ) : message.state === "stopped" ? (
                <div className="assistant-error stopped">
                  <CircleStop size={15} />
                  実行を停止しました。
                </div>
              ) : message.result ? (
                <AssistantResult
                  message={message}
                  copiedId={copiedId}
                  onCopy={onCopy}
                />
              ) : (
                <div className="message-bubble">{message.text}</div>
              )}
            </div>
          </article>
        ))}
      </div>

      <form className="chat-composer" onSubmit={onSubmit}>
        {error && !hasMessages && (
          <div className="composer-error">{error}</div>
        )}
        <div className="chat-input-shell">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            placeholder={hasMessages ? "続けて指示を入力…" : "指示を入力…"}
            disabled={active}
            rows={3}
            aria-label="エージェントへの指示"
          />
          <button
            type="submit"
            aria-label="指示を送信"
            disabled={active || !draft.trim()}
          >
            {active ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <small>
          {active ? status : "Enter で送信 / Shift + Enter で改行"}
        </small>
      </form>
    </aside>
  );
}
