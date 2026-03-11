"""时间与休息时段工具"""
from app.models import DayConfig

DEFAULT_WORK_START = "08:00"
DEFAULT_WORK_END = "22:00"
DEFAULT_LUNCH_START = "12:00"
DEFAULT_LUNCH_DURATION = 90
DEFAULT_DINNER_START = "18:00"
DEFAULT_DINNER_DURATION = 60


def time_to_minutes(h: int, m: int) -> int:
    return h * 60 + m


def minutes_to_time(total: int) -> tuple[int, int]:
    return total // 60, total % 60


def parse_time(s: str) -> tuple[int, int]:
    parts = s.split(":")
    return int(parts[0]), int(parts[1]) if len(parts) > 1 else 0


def get_work_range(db) -> tuple[int, int]:
    """返回 (start_min, end_min) 从 0:00 起算"""
    cfg = db.query(DayConfig).first()
    if not cfg:
        return time_to_minutes(8, 0), time_to_minutes(22, 0)
    work_start = getattr(cfg, "work_start", None) or DEFAULT_WORK_START
    work_end = getattr(cfg, "work_end", None) or DEFAULT_WORK_END
    sh, sm = parse_time(work_start)
    eh, em = parse_time(work_end)
    return time_to_minutes(sh, sm), time_to_minutes(eh, em)


def get_break_ranges(db) -> list[tuple[int, int]]:
    cfg = db.query(DayConfig).first()
    if not cfg:
        return []
    ranges = []
    lunch_start = cfg.lunch_start or DEFAULT_LUNCH_START
    lunch_dur = cfg.lunch_duration if cfg.lunch_duration is not None else DEFAULT_LUNCH_DURATION
    lh, lm = parse_time(lunch_start)
    ranges.append((time_to_minutes(lh, lm), time_to_minutes(lh, lm) + lunch_dur))
    dinner_start = cfg.dinner_start or DEFAULT_DINNER_START
    dinner_dur = cfg.dinner_duration if cfg.dinner_duration is not None else DEFAULT_DINNER_DURATION
    dh, dm = parse_time(dinner_start)
    ranges.append((time_to_minutes(dh, dm), time_to_minutes(dh, dm) + dinner_dur))
    return sorted(ranges)


def skip_breaks(total_min: int, duration: int, break_ranges: list[tuple[int, int]]) -> int:
    end_min = total_min + duration
    for b_start, b_end in break_ranges:
        if total_min < b_end and end_min > b_start:
            return b_end
    return total_min
