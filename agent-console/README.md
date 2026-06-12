# Agent Console

レガシーWebアプリケーションとは独立して動作する、汎用ブラウザAIエージェントのデモ用コンソールです。

- `frontend/`: React + Vite の操作画面
- `backend/`: FastAPI + Browser Use の実行API
- `docs/design-concept.png`: UIデザインコンセプト

既存のモックアプリケーションはリポジトリ直下で `http://127.0.0.1:4173` に起動します。Agent Consoleは別プロセスとして、フロントエンドを `http://127.0.0.1:5173`、APIを `http://127.0.0.1:8000` に起動します。

## 起動

### 1. 対象となるモックアプリケーション

```bash
cd /path/to/jinkyumock
npm start
```

### 2. Agent Console API

Python 3.11から3.13と [uv](https://docs.astral.sh/uv/) が必要です。

```bash
cd agent-console/backend
uv sync --extra dev --extra live
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

実ブラウザモードを利用する場合は、`agent-console/.env.example` を `agent-console/.env` にコピーし、利用するプロバイダーのAPIキーを設定してください。初回のみBrowser Useが要求するブラウザをセットアップします。

```bash
uv run browser-use install
```

### 3. Agent Console UI

```bash
cd agent-console/frontend
npm install
npm run dev
```

ブラウザで <http://127.0.0.1:5173> を開きます。

## モード

- **デモ再生**: APIキー不要。SSEイベント、進行タイムライン、停止、結果表示を実演できます。
- **実ブラウザ**: Browser Useで対象URLを操作します。許可ドメインと安全条件を実行プロンプトへ強制的に追加します。

対象URL、許可ドメイン、タスク、プロバイダー、モデルはUIから変更できるため、特定のモックアプリケーション専用ではありません。デモ時の初期URLは `VITE_DEFAULT_TARGET_URL` で差し替えられます。

## テスト

```bash
cd agent-console/backend
uv run pytest

cd ../frontend
npm run build
```

