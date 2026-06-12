import asyncio
import importlib.util
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .models import RunRequest


TERMINAL_STATUSES = {"failed", "stopped", "completed"}


def utc_time() -> str:
    return datetime.now(timezone.utc).isoformat()


def browser_use_available() -> bool:
    return importlib.util.find_spec("browser_use") is not None


def provider_configuration() -> dict[str, bool]:
    return {
        "google": bool(os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")),
        "openai": bool(os.getenv("OPENAI_API_KEY")),
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
        "browser-use": bool(os.getenv("BROWSER_USE_API_KEY")),
    }


def _host_and_port(value: str) -> tuple[str, int | None]:
    candidate = value if "://" in value else f"https://{value}"
    parsed = urlparse(candidate)
    return (parsed.hostname or "").lower(), parsed.port


def domain_matches(target_url: str, allowed_domains: list[str]) -> bool:
    target = urlparse(target_url)
    target_host = (target.hostname or "").lower()
    target_port = target.port

    for allowed in allowed_domains:
        candidate = allowed.strip()
        if not candidate:
            continue

        wildcard = candidate.startswith("*.")
        if wildcard:
            candidate = candidate[2:]

        allowed_host, allowed_port = _host_and_port(candidate)
        if not allowed_host:
            continue

        host_matches = (
            target_host == allowed_host
            or (wildcard and target_host.endswith(f".{allowed_host}"))
        )
        port_matches = allowed_port is None or allowed_port == target_port
        if host_matches and port_matches:
            return True
    return False


def build_agent_task(request: RunRequest) -> str:
    rules = [
        f"Start from this URL: {request.target_url}",
        "Never navigate outside these allowed domains: "
        + ", ".join(request.allowed_domains),
    ]
    if request.safety.prevent_writes:
        rules.append("Do not create, update, submit, delete, or otherwise modify data.")
    if request.safety.prevent_sensitive_input:
        rules.append(
            "Do not enter personal, confidential, payment, or credential data unless "
            "it is already supplied in the task for this PoC."
        )
    if request.safety.prevent_downloads:
        rules.append("Do not download files.")
    if request.safety.require_final_verification:
        rules.append(
            "Before finishing, verify the visible result and distinguish observed facts "
            "from assumptions."
        )

    rules.append(
        "Finish with a concise summary of actions, extracted values, verification "
        "evidence, and any uncertainty."
    )
    return f"{request.task.strip()}\n\nSafety and execution constraints:\n- " + "\n- ".join(rules)


@dataclass
class RunRecord:
    id: str
    request: RunRequest
    status: str = "queued"
    created_at: str = field(default_factory=utc_time)
    started_at: float | None = None
    events: list[dict[str, Any]] = field(default_factory=list)
    stop_requested: bool = False
    changed: asyncio.Event = field(default_factory=asyncio.Event)

    def emit(self, event_type: str, **payload: Any) -> None:
        self.events.append(
            {
                "type": event_type,
                "run_id": self.id,
                "time": utc_time(),
                **payload,
            }
        )
        self.changed.set()

    def set_status(self, status: str) -> None:
        self.status = status
        self.emit("status", status=status)


class RunManager:
    def __init__(self) -> None:
        self.runs: dict[str, RunRecord] = {}
        self._tasks: set[asyncio.Task[Any]] = set()

    def create(self, request: RunRequest) -> RunRecord:
        if not domain_matches(request.target_url, request.allowed_domains):
            raise ValueError("対象URLが許可ドメインに含まれていません。")

        run = RunRecord(id=uuid.uuid4().hex[:12], request=request)
        self.runs[run.id] = run
        task = asyncio.create_task(self._execute(run))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return run

    def get(self, run_id: str) -> RunRecord | None:
        return self.runs.get(run_id)

    async def _execute(self, run: RunRecord) -> None:
        try:
            if run.request.execution_mode == "demo":
                await self._execute_demo(run)
            else:
                await self._execute_live(run)
        except asyncio.CancelledError:
            if run.status not in TERMINAL_STATUSES:
                run.set_status("stopped")
            raise
        except Exception as exc:
            run.emit("error", message=str(exc))
            run.set_status("failed")

    async def _execute_demo(self, run: RunRecord) -> None:
        run.started_at = asyncio.get_running_loop().time()
        run.set_status("running")
        run.emit(
            "browser",
            url=run.request.target_url,
            title="対象アプリケーション",
            screenshot=None,
        )

        demo_steps = [
            (
                "planning",
                "計画",
                "指示と安全条件を分解",
                "対象URL、許可範囲、完了条件を確認しています。",
                [{"plan": "open → authenticate if needed → locate → verify → summarize"}],
            ),
            (
                "observation",
                "観察",
                "画面構造を読み取り",
                "利用可能なナビゲーションと入力項目を識別しています。",
                [{"observe": "visible controls and current application state"}],
            ),
            (
                "action",
                "操作",
                "対象レコードへ移動",
                "検索条件を入力し、先頭の結果から詳細画面を開いています。",
                [{"action": "search and open the first matching result"}],
            ),
            (
                "verification",
                "検証",
                "表示値と操作結果を確認",
                "取得値を画面上で再確認し、実行結果を整理しています。",
                [{"verify": "compare extracted values with visible details"}],
            ),
        ]

        for index, (stage, label, title, detail, actions) in enumerate(demo_steps, 1):
            if run.stop_requested:
                run.set_status("stopped")
                return
            run.emit(
                "step",
                step=index,
                stage=stage,
                label=label,
                title=title,
                detail=detail,
                actions=actions,
                status="active",
            )
            await asyncio.sleep(0.75)
            run.emit("step_update", step=index, status="completed")

        duration = round(asyncio.get_running_loop().time() - run.started_at, 2)
        run.emit(
            "result",
            success=True,
            result={
                "summary": (
                    "対象アプリケーションを開き、指定条件で検索し、先頭結果の"
                    "詳細と主要項目を画面上で確認しました。"
                ),
                "record_id": "DEMO-001",
                "status": "確認済み",
                "last_updated": "2026-06-12 15:40",
                "verification": "詳細画面を再表示して一致を確認",
                "note": "デモ再生のサンプル結果です。実ブラウザモードでは実際の観察値を返します。",
            },
            duration_seconds=duration,
            steps=len(demo_steps),
        )
        run.set_status("completed")

    async def _execute_live(self, run: RunRecord) -> None:
        if not browser_use_available():
            raise RuntimeError(
                "Browser Useがインストールされていません。`uv sync --extra live`を実行してください。"
            )

        configured = provider_configuration()
        if not configured.get(run.request.provider):
            raise RuntimeError(
                f"{run.request.provider} のAPIキーが設定されていません。"
            )

        from browser_use import (  # type: ignore[import-not-found]
            Agent,
            Browser,
            BrowserProfile,
            ChatAnthropic,
            ChatBrowserUse,
            ChatGoogle,
            ChatOpenAI,
        )

        llm_classes = {
            "google": ChatGoogle,
            "openai": ChatOpenAI,
            "anthropic": ChatAnthropic,
            "browser-use": ChatBrowserUse,
        }
        trace_dir = Path(
            os.getenv("AGENT_TRACE_DIR")
            or Path(__file__).resolve().parents[1] / "traces"
        )
        trace_dir.mkdir(parents=True, exist_ok=True)

        browser = Browser(
            browser_profile=BrowserProfile(
                headless=run.request.headless,
                allowed_domains=run.request.allowed_domains,
                window_size={"width": 1280, "height": 900},
                traces_dir=str(trace_dir),
            )
        )
        run.started_at = asyncio.get_running_loop().time()
        run.set_status("running")
        run.emit(
            "browser",
            url=run.request.target_url,
            title="対象アプリケーション",
            screenshot=None,
        )

        async def on_step(
            browser_state: Any,
            agent_output: Any,
            step_number: int,
        ) -> None:
            state = (
                browser_state.model_dump(exclude_none=True)
                if hasattr(browser_state, "model_dump")
                else {}
            )
            output = (
                agent_output.model_dump(exclude_none=True)
                if hasattr(agent_output, "model_dump")
                else {}
            )
            run.emit(
                "browser",
                url=state.get("url") or run.request.target_url,
                title=state.get("title") or "対象アプリケーション",
                screenshot=state.get("screenshot"),
            )
            run.emit(
                "step",
                step=step_number,
                stage="observation",
                label="観察と操作",
                title=output.get("next_goal") or f"ステップ {step_number}",
                detail=(
                    output.get("thinking")
                    or output.get("evaluation_previous_goal")
                    or "ブラウザの状態を確認しています。"
                ),
                actions=output.get("action") or output.get("actions") or [],
                status="active",
            )
            if step_number > 1:
                run.emit("step_update", step=step_number - 1, status="completed")

        async def should_stop() -> bool:
            return run.stop_requested

        agent = Agent(
            task=build_agent_task(run.request),
            llm=llm_classes[run.request.provider](model=run.request.model),
            browser=browser,
            register_new_step_callback=on_step,
            register_should_stop_callback=should_stop,
            calculate_cost=True,
        )

        try:
            history = await agent.run(max_steps=run.request.max_steps)
            if run.stop_requested:
                run.set_status("stopped")
                return

            final_result = history.final_result() if hasattr(history, "final_result") else str(history)
            success = (
                history.is_successful()
                if hasattr(history, "is_successful")
                else True
            )
            duration = round(asyncio.get_running_loop().time() - run.started_at, 2)
            run.emit(
                "result",
                success=success,
                result={
                    "summary": final_result or "エージェントの実行が完了しました。",
                    "visited_urls": history.urls() if hasattr(history, "urls") else [],
                    "actions": (
                        history.action_names()
                        if hasattr(history, "action_names")
                        else []
                    ),
                    "errors": history.errors() if hasattr(history, "errors") else [],
                    "verification": "Browser Useの実行履歴と最終画面に基づく結果",
                },
                duration_seconds=duration,
            )
            run.set_status("completed" if success is not False else "failed")
        finally:
            try:
                await browser.close()
            except Exception as exc:
                run.emit("warning", message=f"Browser close warning: {exc}")


manager = RunManager()

