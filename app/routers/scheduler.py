from datetime import date, datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task, UserStats
from app.schemas import ScheduleRequest, TaskResponse

router = APIRouter()


from app.utils import (
    time_to_minutes,
    minutes_to_time,
    parse_time,
    get_break_ranges,
    get_work_range,
    skip_breaks,
)


def time_add_minutes(h: int, m: int, add: int) -> tuple[int, int]:
    return minutes_to_time(time_to_minutes(h, m) + add)


def format_time(h: int, m: int) -> str:
    return f"{h:02d}:{m:02d}"


def ceil_to_30min(now: datetime) -> int:
    """当前时间向上取整到 30 分钟，如 13:50 → 14:00"""
    total = now.hour * 60 + now.minute
    return ((total + 29) // 30) * 30


def _get_completed_ranges(tasks: list) -> list[tuple[int, int]]:
    """获取已完成任务的时间段 (start_min, end_min)"""
    ranges = []
    for t in tasks:
        if t.status != "completed" or not t.start_time:
            continue
        sh, sm = parse_time(t.start_time)
        start_min = time_to_minutes(sh, sm)
        if t.actual_end_time:
            eh, em = parse_time(t.actual_end_time)
            end_min = time_to_minutes(eh, em)
        else:
            end_min = start_min + t.duration
        ranges.append((start_min, end_min))
    return sorted(ranges)


def _advance_past_completed(start_min: int, completed_ranges: list[tuple[int, int]]) -> int:
    """若 start_min 落在已完成时段内，推进到该时段之后"""
    for s, e in completed_ranges:
        if s <= start_min < e:
            return e
    return start_min


@router.post("/schedule", response_model=list[TaskResponse])
def schedule_tasks(req: ScheduleRequest, db: Session = Depends(get_db)):
    tasks = (
        db.query(Task)
        .filter(Task.scheduled_date == req.date)
        .order_by(Task.sort_order, Task.created_at)
        .all()
    )
    if not tasks:
        return []

    completed = [t for t in tasks if t.status == "completed"]
    pending = [t for t in tasks if t.status == "pending"]

    break_ranges = get_break_ranges(db)
    stats = db.query(UserStats).first()
    current_energy = stats.current_energy if stats else 100.0

    mental = [t for t in pending if t.activity_type == "mental"]
    physical = [t for t in pending if t.activity_type == "physical"]
    rest = [t for t in pending if t.activity_type == "rest"]

    # 待办按活动类型排序
    if current_energy < 40:
        ordered_pending = physical + rest + mental
    else:
        ordered_pending = []
        i_m, i_p, i_r = 0, 0, 0
        last_was_mental = False
        while i_m < len(mental) or i_p < len(physical) or i_r < len(rest):
            if last_was_mental:
                if i_p < len(physical):
                    ordered_pending.append(physical[i_p])
                    i_p += 1
                    last_was_mental = False
                elif i_r < len(rest):
                    ordered_pending.append(rest[i_r])
                    i_r += 1
                    last_was_mental = False
                elif i_m < len(mental):
                    ordered_pending.append(mental[i_m])
                    i_m += 1
                    last_was_mental = True
            else:
                if i_m < len(mental):
                    ordered_pending.append(mental[i_m])
                    i_m += 1
                    last_was_mental = True
                elif i_p < len(physical):
                    ordered_pending.append(physical[i_p])
                    i_p += 1
                elif i_r < len(rest):
                    ordered_pending.append(rest[i_r])
                    i_r += 1

    # 最终顺序：已完成在上（按时间），待办在下
    def _task_end_min(t):
        if t.actual_end_time:
            eh, em = parse_time(t.actual_end_time)
            return time_to_minutes(eh, em)
        if t.start_time:
            sh, sm = parse_time(t.start_time)
            return time_to_minutes(sh, sm) + t.duration
        return 0

    completed_sorted = sorted(completed, key=_task_end_min)
    final_ordered = completed_sorted + ordered_pending

    start_min, end_min = get_work_range(db)
    completed_ranges = _get_completed_ranges(completed)

    # from_now 时，排程起点不早于当前时间（向上取整到 30 分钟）
    min_start_min = start_min
    if req.from_now:
        today = date.today().isoformat()
        if req.date == today:
            now = datetime.now()
            now_min = now.hour * 60 + now.minute
            if start_min <= now_min < end_min:
                min_start_min = ceil_to_30min(now)
                start_min = min_start_min
                while True:
                    next_start = _advance_past_completed(start_min, completed_ranges)
                    if next_start == start_min:
                        break
                    start_min = next_start

    total_min = start_min
    for i, task in enumerate(final_ordered):
        if total_min >= end_min:
            break
        if task.status == "completed":
            total_min = _task_end_min(task)
            task.sort_order = i
            continue
        # 待办任务：确保不早于当前时间（避免填满左侧时间条空白而忽略现实时间）
        if req.from_now and req.date == date.today().isoformat():
            total_min = max(total_min, min_start_min)
        total_min = skip_breaks(total_min, task.duration, break_ranges)
        if total_min >= end_min:
            break
        total_min = _advance_past_completed(total_min, completed_ranges)
        if total_min >= end_min:
            break
        total_min = skip_breaks(total_min, task.duration, break_ranges)
        if total_min >= end_min:
            break
        h, m = minutes_to_time(total_min)
        task.start_time = format_time(h, m)
        task.sort_order = i
        total_min += task.duration

    db.commit()
    for t in final_ordered:
        db.refresh(t)
    return final_ordered
