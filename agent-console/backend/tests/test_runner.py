import asyncio

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models import RunRequest
from app.runner import RunManager, build_agent_task, domain_matches


def make_request(**overrides):
    data = {
        "target_url": "http://127.0.0.1:4173",
        "task": "対象画面を開き、表示内容を確認してください。",
        "allowed_domains": ["http://127.0.0.1:4173"],
        "execution_mode": "demo",
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


def test_demo_run_reaches_completed_state():
    async def exercise():
        manager = RunManager()
        run = manager.create(make_request())
        for _ in range(80):
            if run.status == "completed":
                break
            await asyncio.sleep(0.1)
        assert run.status == "completed"
        assert any(event["type"] == "result" for event in run.events)
        assert sum(event["type"] == "step" for event in run.events) == 4

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
        assert response.json()["demo_available"] is True

    asyncio.run(exercise())
