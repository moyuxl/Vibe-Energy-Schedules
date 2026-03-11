from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task
from app.schemas import TaskCreate, TaskUpdate, TaskResponse, ReorderRequest
from app.utils import time_to_minutes, minutes_to_time, parse_time, get_break_ranges, get_work_range, skip_breaks

router = APIRouter()

# 精力：脑力消耗（正值），体力/休息恢复（负值=增益）
# 休息也用脑力，恢复率 80%；体力恢复率 40%（基准 30/30min）
ENERGY_COST_MAP = {
    "mental": 15.0,     # 消耗精力
    "physical": -12.0,  # 恢复 40%（30min→12）
    "rest": -24.0,     # 恢复 80%（30min→24）
}


def calc_energy_cost(duration: int, activity_type: str) -> float:
    base = ENERGY_COST_MAP.get(activity_type, 10.0)
    return round(base * (duration / 30.0), 1)


@router.get("", response_model=list[TaskResponse])
def get_tasks(date: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Task)
    if date:
        query = query.filter(Task.scheduled_date == date)
    # 已完成排上面，再按 sort_order
    tasks = (
        query.order_by(
            (Task.status == "completed").desc(),
            Task.sort_order,
            Task.created_at,
        )
        .all()
    )
    return tasks


@router.post("", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    energy_cost = calc_energy_cost(task.duration, task.activity_type)
    db_task = Task(
        title=task.title,
        duration=task.duration,
        activity_type=task.activity_type,
        energy_cost=energy_cost,
        scheduled_date=task.scheduled_date,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, update: TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    data = update.model_dump(exclude_unset=True)
    if "activity_type" in data or "duration" in data:
        duration = data.get("duration", db_task.duration) or db_task.duration
        activity_type = data.get("activity_type", db_task.activity_type) or db_task.activity_type
        data["energy_cost"] = calc_energy_cost(duration, activity_type)
    for k, v in data.items():
        setattr(db_task, k, v)
    db.commit()
    db.refresh(db_task)

    # 若修改了 start_time，自动重排该任务之后的待办
    if "start_time" in data and db_task.scheduled_date:
        _reschedule_after(db, db_task)

    return db_task


def _reschedule_after(db: Session, modified_task: Task):
    """从 modified_task 之后开始重排时间"""
    tasks = (
        db.query(Task)
        .filter(Task.scheduled_date == modified_task.scheduled_date)
        .order_by(Task.sort_order, Task.created_at)
        .all()
    )
    idx = next((i for i, t in enumerate(tasks) if t.id == modified_task.id), -1)
    if idx < 0 or idx >= len(tasks) - 1:
        return
    subsequent = tasks[idx + 1 :]
    if not subsequent:
        return
    if modified_task.actual_end_time:
        eh, em = parse_time(modified_task.actual_end_time)
        start_min = time_to_minutes(eh, em)
    else:
        sh, sm = parse_time(modified_task.start_time or "08:00")
        start_min = time_to_minutes(sh, sm) + modified_task.duration
    break_ranges = get_break_ranges(db)
    _, end_min = get_work_range(db)
    _assign_times_from(subsequent, start_min, break_ranges, end_min)
    db.commit()


def _assign_times_from(tasks_in_order: list[Task], start_min: int, break_ranges: list, end_min: int):
    """按顺序为任务分配 start_time，已完成任务保留原时间并作为下一任务起点"""
    total_min = start_min
    for t in tasks_in_order:
        if total_min >= end_min:
            break
        if t.status == "completed":
            if t.actual_end_time:
                eh, em = parse_time(t.actual_end_time)
                total_min = time_to_minutes(eh, em)
            elif t.start_time:
                sh, sm = parse_time(t.start_time)
                total_min = time_to_minutes(sh, sm) + t.duration
            continue
        total_min = skip_breaks(total_min, t.duration, break_ranges)
        if total_min >= end_min:
            break
        h, m = minutes_to_time(total_min)
        t.start_time = f"{h:02d}:{m:02d}"
        total_min += t.duration


@router.post("/reorder", response_model=list[TaskResponse])
def reorder_tasks(req: ReorderRequest, db: Session = Depends(get_db)):
    tasks = (
        db.query(Task)
        .filter(Task.scheduled_date == req.date, Task.id.in_(req.task_ids))
        .all()
    )
    if len(tasks) != len(req.task_ids):
        raise HTTPException(status_code=400, detail="Invalid task ids")
    id_to_task = {t.id: t for t in tasks}
    # 强制已完成在上，保持用户拖拽的组内顺序
    completed_ids = [tid for tid in req.task_ids if id_to_task[tid].status == "completed"]
    pending_ids = [tid for tid in req.task_ids if id_to_task[tid].status == "pending"]
    ordered = [id_to_task[tid] for tid in completed_ids + pending_ids]
    for i, t in enumerate(ordered):
        t.sort_order = i
    break_ranges = get_break_ranges(db)
    start_min, end_min = get_work_range(db)
    _assign_times_from(ordered, start_min, break_ranges, end_min)
    db.commit()
    return (
        db.query(Task)
        .filter(Task.scheduled_date == req.date)
        .order_by((Task.status == "completed").desc(), Task.sort_order)
        .all()
    )


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
    return {"ok": True}
