from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, field_validator
from app.models.task import TaskPriority, TaskStatus

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.TODO
    due_date: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    category_id: Optional[int] = None

    @field_validator("category_id", mode="before")
    @classmethod
    def validate_category_id(cls, v: Any):
        if v == "" or v == "none" or v is None:
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    category_id: Optional[int] = None

    @field_validator("category_id", mode="before")
    @classmethod
    def validate_category_id(cls, v: Any):
        if v == "" or v == "none" or v is None:
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return None

class TaskOut(TaskBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TaskStats(BaseModel):
    total: int = 0
    pending: int = 0
    in_progress: int = 0
    completed: int = 0
    overdue: int = 0
