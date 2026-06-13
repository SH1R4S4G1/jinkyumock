import { Monitor, RotateCcw, Settings2, X } from "lucide-react";
import { PROVIDERS } from "../config";
import { CheckControl, EnvironmentRow } from "./Controls";

export default function SettingsDrawer({
  open,
  onClose,
  settings,
  updateSettings,
  selectProvider,
  health,
  active,
  onReset,
}) {
  if (!open) return null;

  return (
    <>
      <button
        className="settings-backdrop"
        type="button"
        aria-label="設定を閉じる"
        onClick={onClose}
      />
      <aside className="settings-drawer" aria-label="設定">
        <div className="drawer-heading">
          <div>
            <Settings2 size={18} />
            <h2>設定</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="設定を閉じる">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-content">
          <section className="drawer-section">
            <h3>接続状態</h3>
            <EnvironmentRow
              label="Browser Use"
              available={Boolean(health?.browser_use_available)}
              detail={
                health?.browser_use_available ? "利用可能" : "未セットアップ"
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

          <section className="drawer-section">
            <h3>環境設定</h3>
            <label className="control-group">
              <span>許可ドメイン</span>
              <textarea
                value={settings.allowedDomains}
                onChange={(event) =>
                  updateSettings("allowedDomains", event.target.value)
                }
                disabled={active}
                rows={3}
              />
              <small>1行またはカンマ区切りで指定</small>
            </label>
            <div className="two-column-controls">
              <label className="control-group">
                <span>プロバイダー</span>
                <select
                  value={settings.provider}
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
                  value={settings.model}
                  onChange={(event) =>
                    updateSettings("model", event.target.value)
                  }
                  disabled={active}
                />
              </label>
            </div>
            <label className="control-group">
              <span>最大ステップ</span>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.maxSteps}
                onChange={(event) =>
                  updateSettings("maxSteps", event.target.value)
                }
                disabled={active}
              />
            </label>
            <label className="headless-toggle">
              <span>
                <Monitor size={16} />
                ブラウザを別画面にも表示
              </span>
              <input
                type="checkbox"
                checked={settings.showBrowser}
                onChange={(event) =>
                  updateSettings("showBrowser", event.target.checked)
                }
                disabled={active}
              />
              <span className="switch" />
            </label>
          </section>

          <section className="drawer-section safety-section">
            <h3>安全条件</h3>
            <CheckControl
              label="データの変更を行わない"
              checked={settings.preventWrites}
              onChange={(value) => updateSettings("preventWrites", value)}
              disabled={active}
            />
            <CheckControl
              label="機密情報を入力しない"
              checked={settings.preventSensitiveInput}
              onChange={(value) =>
                updateSettings("preventSensitiveInput", value)
              }
              disabled={active}
            />
            <CheckControl
              label="ファイルをダウンロードしない"
              checked={settings.preventDownloads}
              onChange={(value) => updateSettings("preventDownloads", value)}
              disabled={active}
            />
            <CheckControl
              label="終了前に結果を再検証する"
              checked={settings.requireFinalVerification}
              onChange={(value) =>
                updateSettings("requireFinalVerification", value)
              }
              disabled={active}
            />
          </section>

          <button
            className="reset-settings"
            type="button"
            onClick={onReset}
            disabled={active}
          >
            <RotateCcw size={14} />
            設定をリセット
          </button>
        </div>
      </aside>
    </>
  );
}

