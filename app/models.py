from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    duration = Column(Integer, default=30)
    activity_type = Column(String(20), default="mental")  # mental / physical / rest
    energy_cost = Column(Float, default=10.0)
    actual_cost = Column(Float, nullable=True)
    actual_energy = Column(Float, nullable=True)  # 用户确认的实际精力消耗
    actual_end_time = Column(String(5), nullable=True)  # HH:mm 实际完成时间
    status = Column(String(20), default="pending")  # pending / completed
    scheduled_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    start_time = Column(String(5), nullable=True)  # HH:mm
    sort_order = Column(Integer, default=0)
    sub_steps = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserStats(Base):
    __tablename__ = "user_stats"

    id = Column(Integer, primary_key=True, index=True)
    current_energy = Column(Float, default=100.0)
    energy_mode = Column(String(20), default="Gentle")  # Gentle / Aggressive
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DayConfig(Base):
    """午休、晚饭休息、工作时间等配置"""
    __tablename__ = "day_config"

    id = Column(Integer, primary_key=True, index=True)
    work_start = Column(String(5), default="08:00")
    work_end = Column(String(5), default="22:00")
    lunch_start = Column(String(5), default="12:00")
    lunch_duration = Column(Integer, default=90)  # 分钟
    dinner_start = Column(String(5), default="18:00")
    dinner_duration = Column(Integer, default=60)  # 分钟


class AppState(Base):
    """应用状态：每日同步（结转、精力重置）记录"""
    __tablename__ = "app_state"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(String(20), nullable=True)  # YYYY-MM-DD


class CompanionLog(Base):
    """陪伴文案 LLM 调用记录：token 消耗"""
    __tablename__ = "companion_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(200), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
