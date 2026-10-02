"""FastAPI application entrypoint."""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import Base, engine
from app.core.security import decode_access_token
from app.models import Category, Task, User  # noqa: F401  (register models with metadata)
from app.routers import auth, categories, tasks
from app.websocket.manager import manager

# For local/dev convenience: auto-create tables if they don't exist.
# In production use Alembic migrations.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Taskora API",
    description="Task management backend built with FastAPI, SQLAlchemy, and PostgreSQL.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/", tags=["Health"])
def root():
    return {"name": "Taskora API", "status": "ok", "docs": "/docs"}


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "healthy"}


app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(categories.router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None):
    """Authenticated WebSocket endpoint.

    Client connects to /ws?token=JWT. The token identifies the user and all
    broadcasts are scoped to that user id.
    """
    if token is None:
        await websocket.close(code=4401)
        return
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=4401)
        return
    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        await websocket.close(code=4401)
        return

    await manager.connect(user_id, websocket)
    try:
        # Send a hello so the client knows it's live
        await websocket.send_text('{"event":"connected","data":{"user_id":%d}}' % user_id)
        while True:
            # Keep-alive; ignore any inbound messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, websocket)