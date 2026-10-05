from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Task, User
from app.routers.deps import get_current_user
from app.schemas.all_schemas import TaskCreate, TaskOut, TaskStats, TaskStatusUpdate, TaskUpdate

router = APIRouter()

@router.get("/stats", response_model=TaskStats)
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    now = datetime.utcnow()
    total = len(tasks)
    pending = sum(1 for t in tasks if str(t.status).lower() in ["todo", "to_do", "pending"])
    in_prog = sum(1 for t in tasks if str(t.status).lower() in ["in_progress", "inprogress"])
    completed = sum(1 for t in tasks if str(t.status).lower() in ["completed", "done"])
    overdue = sum(1 for t in tasks if t.due_date and t.due_date < now and str(t.status).lower() not in ["completed", "done", "cancelled"])
    return {"total": total, "pending": pending, "in_progress": in_prog, "completed": completed, "overdue": overdue}

@router.get("", response_model=List[TaskOut])
def get_tasks(
    view: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    sort: Optional[str] = Query("created_at"),
    order: Optional[str] = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Task).filter(Task.user_id == current_user.id)
    if search:
        query = query.filter(Task.title.ilike(f"%{search}%"))
    if status and status.lower() not in ["all", "all statuses", ""]:
        s = status.lower().replace(" ", "_")
        if s == "to_do": s = "todo"
        query = query.filter(Task.status == s)
    if priority and priority.lower() not in ["all", "all priorities", ""]:
        query = query.filter(Task.priority == priority.lower())
    if category_id and category_id not in ["all", "none", "", None]:
        try:
            query = query.filter(Task.category_id == int(category_id))
        except:
            pass
    order_col = getattr(Task, sort if hasattr(Task, sort) else "created_at")
    if order == "asc":
        query = query.order_by(order_col.asc().nulls_last())
    else:
        query = query.order_by(order_col.desc().nulls_last())
    return query.all()

@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = Task(
        title=task_in.title,
        description=task_in.description,
        priority=str(task_in.priority).lower(),
        status=str(task_in.status).lower().replace(" ", "_"),
        due_date=task_in.due_date,
        reminder_at=task_in.reminder_at,
        category_id=task_in.category_id,
        user_id=current_user.id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return t

@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, task_in: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in task_in.model_dump(exclude_unset=True).items():
        setattr(t, key, value)
    db.commit()
    db.refresh(t)
    return t

@router.patch("/{task_id}/status", response_model=TaskOut)
def patch_task_status(task_id: int, s_in: TaskStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    t.status = s_in.status
    db.commit()
    db.refresh(t)
    return t

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(t)
    db.commit()
    return None
