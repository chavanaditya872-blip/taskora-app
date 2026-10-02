"""Task CRUD routes."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.category import Category
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.routers.deps import get_current_user
from app.schemas.task import TaskCreate, TaskOut, TaskStats, TaskStatusUpdate, TaskUpdate
from app.websocket.manager import manager

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


def _serialize(task: Task) -> dict:
    return TaskOut.model_validate(task).model_dump(mode="json")


async def _broadcast(user_id: int, event: str, task: Task):
    await manager.broadcast_to_user(user_id, event, _serialize(task))


def _get_owned_task(task_id: int, user_id: int, db: Session) -> Task:
    task = db.get(Task, task_id)
    if not task or task.user_id != user_id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=list[TaskOut])
def list_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    priority: TaskPriority | None = Query(default=None),
    category_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    view: str | None = Query(default=None, description="today|upcoming|overdue|completed|pending"),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc"),
):
    """List tasks with filters and sorting."""
    stmt = select(Task).where(Task.user_id == current_user.id)

    if status_filter:
        stmt = stmt.where(Task.status == status_filter)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if category_id:
        stmt = stmt.where(Task.category_id == category_id)
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(func.lower(Task.title).like(like) | func.lower(Task.description).like(like))

    now = datetime.now(timezone.utc)
    if view == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start.replace(hour=23, minute=59, second=59)
        stmt = stmt.where(Task.due_date >= start, Task.due_date <= end)
    elif view == "upcoming":
        stmt = stmt.where(Task.due_date > now, Task.status != TaskStatus.COMPLETED)
    elif view == "overdue":
        stmt = stmt.where(
            Task.due_date < now,
            Task.status.notin_([TaskStatus.COMPLETED, TaskStatus.CANCELLED]),
        )
    elif view == "completed":
        stmt = stmt.where(Task.status == TaskStatus.COMPLETED)
    elif view == "pending":
        stmt = stmt.where(Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]))

    sort_col = {
        "due_date": Task.due_date,
        "priority": Task.priority,
        "created_at": Task.created_at,
        "title": Task.title,
    }.get(sort, Task.created_at)

    stmt = stmt.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    tasks = list(db.scalars(stmt))
    return [TaskOut.model_validate(t) for t in tasks]


@router.get("/stats", response_model=TaskStats)
def stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    rows = db.execute(
        select(Task.status, func.count(Task.id))
        .where(Task.user_id == current_user.id)
        .group_by(Task.status)
    ).all()
    counts = {status_: n for status_, n in rows}
    overdue = db.scalar(
        select(func.count(Task.id)).where(
            Task.user_id == current_user.id,
            Task.due_date < now,
            Task.status.notin_([TaskStatus.COMPLETED, TaskStatus.CANCELLED]),
        )
    ) or 0
    total = sum(counts.values())
    return TaskStats(
        total=total,
        pending=counts.get(TaskStatus.TODO, 0),
        in_progress=counts.get(TaskStatus.IN_PROGRESS, 0),
        completed=counts.get(TaskStatus.COMPLETED, 0),
        cancelled=counts.get(TaskStatus.CANCELLED, 0),
        overdue=overdue,
    )


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, current_user.id, db)
    return TaskOut.model_validate(task)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.category_id is not None:
        cat = db.get(Category, payload.category_id)
        if not cat or cat.user_id != current_user.id:
            raise HTTPException(status_code=400, detail="Invalid category")

    task = Task(
        user_id=current_user.id,
        title=payload.title.strip(),
        description=(payload.description or "").strip() or None,
        priority=payload.priority,
        status=payload.status,
        category_id=payload.category_id,
        due_date=payload.due_date,
        reminder_at=payload.reminder_at,
    )
    if task.status == TaskStatus.COMPLETED:
        task.completed_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    await _broadcast(current_user.id, "task.created", task)
    return TaskOut.model_validate(task)


@router.put("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, current_user.id, db)

    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data and data["category_id"] is not None:
        cat = db.get(Category, data["category_id"])
        if not cat or cat.user_id != current_user.id:
            raise HTTPException(status_code=400, detail="Invalid category")

    previous_status = task.status
    for field, value in data.items():
        if field == "title" and isinstance(value, str):
            value = value.strip()
        if field == "description" and isinstance(value, str):
            value = value.strip() or None
        setattr(task, field, value)

    if "status" in data and task.status != previous_status:
        if task.status == TaskStatus.COMPLETED:
            task.completed_at = datetime.now(timezone.utc)
        else:
            task.completed_at = None

    db.commit()
    db.refresh(task)
    await _broadcast(current_user.id, "task.updated", task)
    return TaskOut.model_validate(task)


@router.patch("/{task_id}/status", response_model=TaskOut)
async def update_status(
    task_id: int,
    payload: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, current_user.id, db)
    task.status = payload.status
    task.completed_at = (
        datetime.now(timezone.utc) if payload.status == TaskStatus.COMPLETED else None
    )
    db.commit()
    db.refresh(task)
    await _broadcast(current_user.id, "task.status_changed", task)
    return TaskOut.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, current_user.id, db)
    payload = _serialize(task)
    db.delete(task)
    db.commit()
    await manager.broadcast_to_user(current_user.id, "task.deleted", payload)
    return None