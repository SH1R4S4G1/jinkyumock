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


def browser_event_payload(
    browser_state: Any,
    *,
    fallback_url: str,
    step_number: int,
) -> dict[str, Any]:
    return {
        "url": getattr(browser_state, "url", fallback_url),
        "title": getattr(browser_state, "title", "対象アプリケーション"),
        "screenshot": getattr(browser_state, "screenshot", None),
        "frame": step_number,
    }


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


def build_agent_task(request: RunRequest, *, follow_up: bool = False) -> str:
    rules = []
    if follow_up:
        rules.append(
            "This is a follow-up instruction. Continue from the browser's current "
            "page and preserve useful session state unless the new instruction requires otherwise. "
            f"The original target URL was {request.target_url}."
        )
    else:
        rules.append(f"Start from this URL: {request.target_url}")
    rules.append(
        "Never navigate outside these allowed domains: "
        + ", ".join(request.allowed_domains)
    )
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
        "Finish with a concise answer to the user that includes actions, extracted "
        "values, verification evidence, and any uncertainty."
    )
    return f"{request.task.strip()}\n\nSafety and execution constraints:\n- " + "\n- ".join(rules)


@dataclass
class RunRecord:
    id: str
    conversation_id: str
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
                "conversation_id": self.conversation_id,
                "time": utc_time(),
                **payload,
            }
        )
        self.changed.set()

    def set_status(self, status: str) -> None:
        self.status = status
        self.emit("status", status=status)


@dataclass
class AgentSession:
    id: str
    signature: tuple[Any, ...]
    browser: Any = None
    agent: Any = None
    run_count: int = 0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class RunManager:
    def __init__(self) -> None:
        self.runs: dict[str, RunRecord] = {}
        self.sessions: dict[str, AgentSession] = {}
        self._tasks: set[asyncio.Task[Any]] = set()

    @staticmethod
    def _session_signature(request: RunRequest) -> tuple[Any, ...]:
        return (
            request.target_url,
            tuple(request.allowed_domains),
            request.provider,
            request.model,
            request.headless,
        )

    def create(self, request: RunRequest) -> RunRecord:
        if not domain_matches(request.target_url, request.allowed_domains):
            raise ValueError("対象URLが許可ドメインに含まれていません。")

        conversation_id = request.conversation_id or uuid.uuid4().hex[:12]
        signature = self._session_signature(request)
        session = self.sessions.get(conversation_id)
        if session and session.signature != signature:
            raise ValueError(
                "同じ会話では対象URL・許可ドメイン・モデル設定を変更できません。"
                "新しい会話を開始してください。"
            )
        if session and session.lock.locked():
            raise ValueError("この会話では別の指示を実行中です。")
        if not session:
            self.sessions[conversation_id] = AgentSession(
                id=conversation_id,
                signature=signature,
            )

        run = RunRecord(
            id=uuid.uuid4().hex[:12],
            conversation_id=conversation_id,
            request=request,
        )
        self.runs[run.id] = run
        task = asyncio.create_task(self._execute(run))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return run

    def get(self, run_id: str) -> RunRecord | None:
        return self.runs.get(run_id)

    async def close_conversation(self, conversation_id: str) -> bool:
        session = self.sessions.pop(conversation_id, None)
        if not session:
            return False
        async with session.lock:
            if session.browser is not None:
                await session.browser.kill()
            if session.agent is not None:
                await session.agent.close()
        return True

    async def _execute(self, run: RunRecord) -> None:
        try:
            await self._execute_live(run)
        except asyncio.CancelledError:
            if run.status not in TERMINAL_STATUSES:
                run.set_status("stopped")
            raise
        except Exception as exc:
            run.emit("error", message=str(exc))
            run.set_status("failed")

    async def _execute_live(self, run: RunRecord) -> None:
        if not browser_use_available():
            raise RuntimeError(
                "Browser Useがインストールされていません。"
                "`uv sync --extra live`を実行してください。"
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

        session = self.sessions[run.conversation_id]
        async with session.lock:
            run.started_at = asyncio.get_running_loop().time()
            run.set_status("running")

            async def on_step(
                browser_state: Any,
                agent_output: Any,
                step_number: int,
            ) -> None:
                output = (
                    agent_output.model_dump(exclude_none=True)
                    if hasattr(agent_output, "model_dump")
                    else {}
                )
                run.emit(
                    "browser",
                    **browser_event_payload(
                        browser_state,
                        fallback_url=run.request.target_url,
                        step_number=step_number,
                    ),
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
                    run.emit(
                        "step_update",
                        step=step_number - 1,
                        status="completed",
                    )

            async def should_stop() -> bool:
                return run.stop_requested

            if session.agent is None:
                session.browser = Browser(
                    browser_profile=BrowserProfile(
                        headless=run.request.headless,
                        allowed_domains=run.request.allowed_domains,
                        keep_alive=True,
                        window_size={"width": 1280, "height": 900},
                        traces_dir=str(trace_dir),
                    )
                )
                session.agent = Agent(
                    task=build_agent_task(run.request),
                    llm=llm_classes[run.request.provider](model=run.request.model),
                    browser=session.browser,
                    register_new_step_callback=on_step,
                    register_should_stop_callback=should_stop,
                    calculate_cost=True,
                )
            else:
                session.agent.register_new_step_callback = on_step
                session.agent.register_should_stop_callback = should_stop
                session.agent.add_new_task(
                    build_agent_task(run.request, follow_up=True)
                )

            history = await session.agent.run(max_steps=run.request.max_steps)
            session.run_count += 1
            if run.stop_requested:
                run.set_status("stopped")
                return

            if history.history:
                last_step = len(history.history)
                run.emit("step_update", step=last_step, status="completed")
                screenshots = history.screenshots(n_last=1)
                if screenshots and screenshots[0]:
                    final_state = history.history[-1].state
                    run.emit(
                        "browser",
                        url=final_state.url,
                        title=final_state.title,
                        screenshot=screenshots[0],
                        frame=last_step,
                    )

            final_result = (
                history.final_result()
                if hasattr(history, "final_result")
                else str(history)
            )
            success = (
                history.is_successful()
                if hasattr(history, "is_successful")
                else True
            )
            duration = round(
                asyncio.get_running_loop().time() - run.started_at,
                2,
            )
            run.emit(
                "result",
                success=success,
                result={
                    "summary": final_result or "エージェントの実行が完了しました。",
                    "visited_urls": (
                        history.urls()
                        if hasattr(history, "urls")
                        else []
                    ),
                    "actions": (
                        history.action_names()
                        if hasattr(history, "action_names")
                        else []
                    ),
                    "errors": (
                        history.errors()
                        if hasattr(history, "errors")
                        else []
                    ),
                    "verification": "Browser Useの実行履歴と最終画面に基づく結果",
                },
                duration_seconds=duration,
                follow_up=session.run_count > 1,
            )
            run.set_status("completed" if success is not False else "failed")


manager = RunManager()
