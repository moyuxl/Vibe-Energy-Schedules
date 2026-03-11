from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DayConfig
from app.utils import (
    DEFAULT_WORK_START,
    DEFAULT_WORK_END,
    DEFAULT_LUNCH_START,
    DEFAULT_LUNCH_DURATION,
    DEFAULT_DINNER_START,
    DEFAULT_DINNER_DURATION,
)
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

DEFAULT_CONFIG = {
    "work_start": DEFAULT_WORK_START,
    "work_end": DEFAULT_WORK_END,
    "lunch_start": DEFAULT_LUNCH_START,
    "lunch_duration": DEFAULT_LUNCH_DURATION,
    "dinner_start": DEFAULT_DINNER_START,
    "dinner_duration": DEFAULT_DINNER_DURATION,
}


class DayConfigUpdate(BaseModel):
    work_start: Optional[str] = None
    work_end: Optional[str] = None
    lunch_start: Optional[str] = None
    lunch_duration: Optional[int] = None
    dinner_start: Optional[str] = None
    dinner_duration: Optional[int] = None


class DayConfigResponse(BaseModel):
    id: int
    work_start: str
    work_end: str
    lunch_start: str
    lunch_duration: int
    dinner_start: str
    dinner_duration: int

    class Config:
        from_attributes = True


def get_or_create_config(db: Session) -> DayConfig:
    cfg = db.query(DayConfig).first()
    if not cfg:
        cfg = DayConfig(**DEFAULT_CONFIG)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    else:
        for k, v in DEFAULT_CONFIG.items():
            if getattr(cfg, k, None) is None:
                setattr(cfg, k, v)
        db.commit()
        db.refresh(cfg)
    return cfg


def _config_to_response(cfg: DayConfig) -> DayConfigResponse:
    return DayConfigResponse(
        id=cfg.id,
        work_start=getattr(cfg, "work_start", None) or DEFAULT_CONFIG["work_start"],
        work_end=getattr(cfg, "work_end", None) or DEFAULT_CONFIG["work_end"],
        lunch_start=cfg.lunch_start or DEFAULT_CONFIG["lunch_start"],
        lunch_duration=cfg.lunch_duration if cfg.lunch_duration is not None else DEFAULT_CONFIG["lunch_duration"],
        dinner_start=cfg.dinner_start or DEFAULT_CONFIG["dinner_start"],
        dinner_duration=cfg.dinner_duration if cfg.dinner_duration is not None else DEFAULT_CONFIG["dinner_duration"],
    )


@router.get("", response_model=DayConfigResponse)
def get_config(db: Session = Depends(get_db)):
    cfg = get_or_create_config(db)
    return _config_to_response(cfg)


@router.patch("", response_model=DayConfigResponse)
def update_config(update: DayConfigUpdate, db: Session = Depends(get_db)):
    cfg = get_or_create_config(db)
    for k, v in update.model_dump(exclude_unset=True).items():
        setattr(cfg, k, v)
    db.commit()
    db.refresh(cfg)
    return _config_to_response(cfg)
