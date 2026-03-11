from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TaskBase(BaseModel):
    title: str
    duration: int = 30
    activity_type: str = "mental"  # mental / physical / rest
    scheduled_date: Optional[str] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    duration: Optional[int] = None
    activity_type: Optional[str] = None
    status: Optional[str] = None
    actual_cost: Optional[float] = None
    actual_energy: Optional[float] = None
    actual_end_time: Optional[str] = None
    start_time: Optional[str] = None


class ReorderRequest(BaseModel):
    date: str
    task_ids: list[int]


class TaskResponse(TaskBase):
    id: int
    energy_cost: float
    actual_cost: Optional[float] = None
    actual_energy: Optional[float] = None
    actual_end_time: Optional[str] = None
    status: str
    start_time: Optional[str] = None
    sort_order: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserStatsBase(BaseModel):
    current_energy: float = 100.0
    energy_mode: str = "Gentle"


class UserStatsUpdate(BaseModel):
    current_energy: Optional[float] = None
    energy_mode: Optional[str] = None


class UserStatsResponse(BaseModel):
    id: int
    current_energy: float
    energy_mode: str
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScheduleRequest(BaseModel):
    date: str  # YYYY-MM-DD
    from_now: bool = False  # True 时从当前时间开始排程
