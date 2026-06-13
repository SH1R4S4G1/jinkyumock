import asyncio
from types import SimpleNamespace

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models import RunRequest
from app.runner import (
    RunManager,
    browser_event_payload,
    build_agent_task,
    domain_matches,
)


def make_request(**overrides):
    data = {
        "target_url": "http://127.0.0.1:4173",
        "task": "対象画面を開き、表示内容を確認してください。",
        "allowed_domains": ["http://127.0.0.1:4173"],
    }
    data.update(overrides)
    return RunRequest(**data)


def test_domain_matches_url_port_and_wildcard():
    assert domain_matches(
        "http://127.0.0.1:4173/path",
        ["http://127.0.0.1:4173"],
    )
    assert not domain_matches(
        "http://127.0.0.1:4173/path",
        ["http://127.0.0.1:3000"],
    )
    assert domain_matches("https://app.example.com", ["*.example.com"])
    assert not domain_matches("https://example.net", ["*.example.com"])


def test_build_agent_task_includes_safety_constraints():
    task = build_agent_task(make_request())
    assert "Never navigate outside" in task
    assert "Do not create, update, submit, delete" in task
    assert "Do not download files" in task
    assert "verify the visible result" in task


def test_follow_up_task_includes_continuation_instruction():
    task = build_agent_task(make_request(), follow_up=True)
    assert "follow-up instruction" in task
    assert "current page" in task
    assert "Start from this URL" not in task


def test_browser_event_reads_dataclass_style_attributes():
    state = SimpleNamespace(
        url="http://127.0.0.1:4173/customer/1",
        title="顧客詳細",
        screenshot="base64-image",
    )
    assert browser_event_payload(
        state,
        fallback_url="http://127.0.0.1:4173",
        step_number=4,
    ) == {
        "url": "http://127.0.0.1:4173/customer/1",
        "title": "顧客詳細",
        "screenshot": "base64-image",
        "frame": 4,
    }


def test_conversation_configuration_must_remain_stable():
    async def exercise():
        manager = RunManager()
        manager._execute = lambda run: asyncio.sleep(0)
        first = manager.create(make_request(conversation_id="conversation-1"))
        assert first.conversation_id == "conversation-1"

        second = make_request(
            conversation_id="conversation-1",
            model="different-model",
        )
        try:
            manager.create(second)
        except ValueError as exc:
            assert "新しい会話" in str(exc)
        else:
            raise AssertionError("configuration change must be rejected")

        await asyncio.sleep(0)

    asyncio.run(exercise())


def test_duplicate_request_id_reuses_the_same_run():
    async def exercise():
        manager = RunManager()
        manager._execute = lambda run: asyncio.sleep(0)
        request = make_request(
            conversation_id="conversation-1",
            request_id="request-1",
        )

        first = manager.create(request)
        second = manager.create(request)

        assert second is first
        assert len(manager.runs) == 1
        await asyncio.sleep(0)

    asyncio.run(exercise())


def test_same_conversation_rejects_a_second_pending_run():
    async def exercise():
        manager = RunManager()
        manager._execute = lambda run: asyncio.sleep(0)
        first = manager.create(make_request(conversation_id="conversation-1"))
        assert first.status == "queued"

        try:
            manager.create(make_request(conversation_id="conversation-1"))
        except ValueError as exc:
            assert "別の指示を実行中" in str(exc)
        else:
            raise AssertionError("a second pending run must be rejected")

        await asyncio.sleep(0)

    asyncio.run(exercise())


def test_close_conversation_kills_keep_alive_browser_before_agent_cleanup():
    async def exercise():
        events = []

        class BrowserStub:
            async def kill(self):
                events.append("browser.kill")

        class AgentStub:
            async def close(self):
                events.append("agent.close")

        manager = RunManager()
        manager.sessions["conversation-1"] = SimpleNamespace(
            lock=asyncio.Lock(),
            browser=BrowserStub(),
            agent=AgentStub(),
            active_run_id=None,
        )

        assert await manager.close_conversation("conversation-1")
        assert events == ["browser.kill", "agent.close"]
        assert "conversation-1" not in manager.sessions

    asyncio.run(exercise())


def test_health_endpoint():
    async def exercise():
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert "demo_available" not in response.json()

    asyncio.run(exercise())
