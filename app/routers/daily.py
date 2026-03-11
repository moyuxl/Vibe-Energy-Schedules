"""每日同步：结转未完成脑力任务、早上精力恢复"""
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task, UserStats, AppState
from app.routers.tasks import calc_energy_cost

router = APIRouter()


def _get_state(db: Session, key: str) -> str | None:
    row = db.query(AppState).filter(AppState.key == key).first()
    return row.value if row else None


def _set_state(db: Session, key: str, value: str):
    row = db.query(AppState).filter(AppState.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppState(key=key, value=value))


@router.post("/sync")
def daily_sync(db: Session = Depends(get_db)):
    """每日同步：结转昨日未完成脑力任务、早上精力恢复到 100"""
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    result = {"carried_over": 0, "energy_reset": False}

    # 1. 结转：前一天未完成的脑力任务 → 今天
    last_carry = _get_state(db, "last_carry_over_date")
    if last_carry != today:
        yesterday_tasks = (
            db.query(Task)
            .filter(
                Task.scheduled_date == yesterday,
                Task.status == "pending",
                Task.activity_type == "mental",
            )
            .all()
        )
        for t in yesterday_tasks:
            new_task = Task(
                title=t.title,
                duration=t.duration,
                activity_type=t.activity_type,
                energy_cost=calc_energy_cost(t.duration, t.activity_type),
                scheduled_date=today,
                status="pending",
            )
            db.add(new_task)
            result["carried_over"] += 1
        _set_state(db, "last_carry_over_date", today)

    # 2. 早上精力恢复到 100
    last_reset = _get_state(db, "last_energy_reset_date")
    if last_reset != today:
        stats = db.query(UserStats).first()
        if stats:
            stats.current_energy = 100.0
            result["energy_reset"] = True
        _set_state(db, "last_energy_reset_date", today)

    db.commit()
    return result
