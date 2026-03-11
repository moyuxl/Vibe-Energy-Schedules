"""AI 情绪陪伴文案：DeepSeek API 代理"""
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from app.database import get_db
from app.models import CompanionLog

# 从项目根目录加载 .env（backend 的上级）
load_dotenv(Path(__file__).resolve().parents[2].parent / ".env")

router = APIRouter()

SYSTEM_PROMPT = """你是用户的任务陪伴助手，性格像一个了解你的朋友——不说废话，不过度鼓励，说的话让人觉得"你懂我"。

输出规则：
- 中文，不超过30字
- 直接输出文案，不加引号、不加表情符号
- 必须带任务名
- 禁止使用"加油""棒棒的""很厉害"这类空洞词

在输出前，先在脑子里判断以下情境（不要输出判断过程，只输出最终文案）：

【情境判断优先级】
1. 精力透支：实际精力 > 预计精力 * 1.3 → 重点是"这任务比想象难，正常，缓一下"
2. 效率超高：实际精力 < 预计精力 * 0.7 → 重点是"你对这个任务已经很熟了"
3. 精力告急：当前精力 < 30% → 重点是"该休息了，不是放弃是保存状态"
4. 今日多产：已完成 >= 5个 → 重点是"积累感，今天做了很多事"
5. 常规完成：其他情况 → 从效率/节奏/陪伴/经验中随机选一个角度

【可选角度参考】（不要照抄，要结合任务名说具体的话）
- 效率角度：这次花的力气和任务本身是否匹配
- 节奏角度：完成后下一步该做什么类型的任务
- 陪伴角度：完成这件事本身的意义
- 经验角度：下次做这类任务可以注意什么"""


class CompanionRequest(BaseModel):
    task_name: str
    activity_type: str
    estimated_energy: float
    actual_energy: float
    completed_count: int
    energy_left: float


FATIGUE_SYSTEM_PROMPT = """你是用户的任务陪伴助手，用户刚刚触发了疲劳预警，语气像朋友，说中文，不超过35字。
直接输出文案，不加引号、不加表情。
禁止使用"加油""要注意休息""照顾好自己"这类空洞建议。

根据触发原因选择角度：
- low_energy：精力快见底了，重点是"现在停下来是为了下午/明天"
- continuous_mental：连续脑力任务的代价是隐性的，重点是"你的大脑需要换个频道"
- energy_overrun：连续超支说明任务比预期难，重点是"不是你的问题，是预估需要校准"

必须结合 recent_tasks 中的具体任务名说话，不要泛泛而谈。"""


class FatigueRequest(BaseModel):
    trigger_reason: str  # low_energy | continuous_mental | energy_overrun
    current_energy: float
    completed_count: int
    recent_tasks: str  # 任务名和实际消耗列表，如 "任务A 15, 任务B 20"


@router.post("/message")
async def get_companion_message(req: CompanionRequest, db: Session = Depends(get_db)) -> dict:
    """调用 DeepSeek 生成个性化陪伴文案"""
    api_key = os.getenv("DEEPSEEK_API_KEY")
    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    model = os.getenv("DEEPSEEK_MODEL_CHAT", "deepseek-chat")

    if not api_key:
        return {"message": None, "error": "missing_api_key"}

    activity_labels = {"mental": "脑力", "physical": "体力", "rest": "休息"}
    user_content = f"""任务名：{req.task_name}
类型：{activity_labels.get(req.activity_type, req.activity_type)}
预计精力：{req.estimated_energy}
实际精力：{req.actual_energy}
今日已完成：{req.completed_count} 个
当前精力：{req.energy_left}%"""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    "max_tokens": 60,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("choices") and len(data["choices"]) > 0:
                text = data["choices"][0].get("message", {}).get("content", "").strip()
                usage = data.get("usage", {})
                prompt_tokens = usage.get("prompt_tokens", 0)
                completion_tokens = usage.get("completion_tokens", 0)
                total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
                log = CompanionLog(
                    task_name=req.task_name,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                )
                db.add(log)
                db.commit()
                return {"message": text}
    except Exception:
        pass
    return {"message": None}


@router.post("/fatigue-message")
async def get_fatigue_message(req: FatigueRequest, db: Session = Depends(get_db)) -> dict:
    """疲劳预警 AI 文案"""
    api_key = os.getenv("DEEPSEEK_API_KEY")
    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    model = os.getenv("DEEPSEEK_MODEL_CHAT", "deepseek-chat")

    if not api_key:
        return {"message": None, "error": "missing_api_key"}

    user_content = f"""触发原因：{req.trigger_reason}
当前精力：{req.current_energy}%
今日完成：{req.completed_count} 个任务
最近任务：{req.recent_tasks}"""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": FATIGUE_SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    "max_tokens": 80,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("choices") and len(data["choices"]) > 0:
                text = data["choices"][0].get("message", {}).get("content", "").strip()
                return {"message": text}
    except Exception:
        pass
    return {"message": None}
