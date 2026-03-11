from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UserStats
from app.schemas import UserStatsUpdate, UserStatsResponse

router = APIRouter()


def get_or_create_stats(db: Session) -> UserStats:
    stats = db.query(UserStats).first()
    if not stats:
        stats = UserStats(current_energy=100.0, energy_mode="Gentle")
        db.add(stats)
        db.commit()
        db.refresh(stats)
    return stats


@router.get("", response_model=UserStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    return get_or_create_stats(db)


@router.patch("", response_model=UserStatsResponse)
def update_stats(update: UserStatsUpdate, db: Session = Depends(get_db)):
    stats = get_or_create_stats(db)
    for k, v in update.model_dump(exclude_unset=True).items():
        setattr(stats, k, v)
    if stats.current_energy is not None:
        stats.current_energy = max(0, min(100, stats.current_energy))
    db.commit()
    db.refresh(stats)
    return stats
