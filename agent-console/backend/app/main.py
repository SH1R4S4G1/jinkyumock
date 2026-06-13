import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from .models import RunCreated, RunRequest
from .runner import (
    TERMINAL_STATUSES,
    browser_use_available,
    manager,
    provider_configuration,
)


load_dotenv(Path(__file__).resolve().parents[2] / ".env")

app = FastAPI(
    title="Agent Console API",
    version="0.1.0",
    description="Generic Browser Use execution API with live event streaming.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "browser_use_available": browser_use_available(),
        "providers": provider_configuration(),
    }


@app.post("/api/runs", response_model=RunCreated, status_code=202)
async def create_run(request: RunRequest) -> RunCreated:
    try:
        run = manager.create(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RunCreated(
        id=run.id,
        conversation_id=run.conversation_id,
        status=run.status,
    )


@app.get("/api/runs/{run_id}")
def get_run(run_id: str) -> dict[str, object]:
    run = manager.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="実行IDが見つかりません。")
    return {
        "id": run.id,
        "status": run.status,
        "created_at": run.created_at,
        "event_count": len(run.events),
        "events": run.events,
    }


@app.get("/api/runs/{run_id}/events")
async def stream_run(run_id: str) -> StreamingResponse:
    run = manager.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="実行IDが見つかりません。")

    async def stream():
        index = 0
        while True:
            while index < len(run.events):
                event = run.events[index]
                index += 1
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

            if run.status in TERMINAL_STATUSES:
                break

            run.changed.clear()
            if index < len(run.events):
                continue
            try:
                await asyncio.wait_for(run.changed.wait(), timeout=15)
            except TimeoutError:
                yield ": keep-alive\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/runs/{run_id}/stop")
def stop_run(run_id: str) -> dict[str, str]:
    run = manager.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="実行IDが見つかりません。")
    if run.status in TERMINAL_STATUSES:
        return {"status": run.status}

    run.stop_requested = True
    run.set_status("stopping")
    return {"status": "stopping"}


@app.delete("/api/conversations/{conversation_id}")
async def close_conversation(conversation_id: str) -> dict[str, str]:
    if not await manager.close_conversation(conversation_id):
        raise HTTPException(status_code=404, detail="会話IDが見つかりません。")
    return {"status": "closed"}


frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
