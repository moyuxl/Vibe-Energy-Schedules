from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine, Base
from app.models import DayConfig, AppState, CompanionLog  # 确保表被创建
from app.routers import tasks, stats, scheduler, config, daily, companion

Base.metadata.create_all(bind=engine)


def _migrate_day_config():
    """为已有 day_config 表添加 work_start/work_end 列"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT work_start FROM day_config LIMIT 1"))
            conn.commit()
    except Exception:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE day_config ADD COLUMN work_start VARCHAR(5) DEFAULT '08:00'"))
                conn.commit()
        except Exception:
            pass
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE day_config ADD COLUMN work_end VARCHAR(5) DEFAULT '22:00'"))
                conn.commit()
        except Exception:
            pass


_migrate_day_config()


def _migrate_tasks_actual_end_time():
    """为已有 tasks 表添加 actual_end_time 列"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT actual_end_time FROM tasks LIMIT 1"))
            conn.commit()
    except Exception:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN actual_end_time VARCHAR(5)"))
                conn.commit()
        except Exception:
            pass


_migrate_tasks_actual_end_time()


def _migrate_tasks_actual_energy():
    """为已有 tasks 表添加 actual_energy 列"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT actual_energy FROM tasks LIMIT 1"))
            conn.commit()
    except Exception:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN actual_energy FLOAT"))
                conn.commit()
        except Exception:
            pass


_migrate_tasks_actual_energy()


app = FastAPI(title="Vibe-Energy-Schedules API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(scheduler.router, prefix="/api/scheduler", tags=["scheduler"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(daily.router, prefix="/api/daily", tags=["daily"])
app.include_router(companion.router, prefix="/api/companion", tags=["companion"])


@app.get("/")
def root():
    return {"message": "Vibe-Energy-Schedules API"}
