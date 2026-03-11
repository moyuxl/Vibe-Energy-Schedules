# Vibe-Energy-Schedules 技术架构概述

> 当前版本：V2.0

## 一、项目概览

日程时间精力管理系统，基于精力消耗与恢复模型，帮助用户合理规划日程、记录精力变化。采用前后端分离架构，前端 Next.js 14，后端 FastAPI，数据持久化于 SQLite。

---

## 二、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 | App Router、React 18 |
| 前端 | Tailwind CSS | 样式 |
| 前端 | TypeScript | 类型安全 |
| 前端 | date-fns | 日期处理 |
| 前端 | lucide-react | 图标 |
| 后端 | FastAPI | REST API |
| 后端 | SQLAlchemy | ORM |
| 后端 | SQLite | 持久化 |
| 后端 | Pydantic | 数据校验 |
| 后端 | httpx | DeepSeek API 调用 |
| 后端 | python-dotenv | 环境变量加载 |

---

## 三、项目结构

```
Vibe-Energy-Schedules/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── main.py             # 入口、CORS、路由注册、迁移
│   │   ├── database.py        # SQLite 连接、Session
│   │   ├── models.py          # Task、UserStats、DayConfig
│   │   ├── schemas.py         # Pydantic 模型
│   │   ├── utils.py           # 时间、休息时段、默认配置
│   │   └── routers/
│   │       ├── tasks.py       # 任务 CRUD、重排
│   │       ├── stats.py       # 精力状态
│   │       ├── scheduler.py   # 一键排程
│   │       ├── config.py      # 日程配置（工作时间、午休、晚饭）
│   │       ├── daily.py       # 每日同步（结转、精力重置）
│   │       └── companion.py   # AI 陪伴文案、疲劳预警文案（DeepSeek）
│   ├── requirements.txt
│   └── vibe_energy.db         # SQLite 数据库（运行时生成）
│
├── frontend/                   # Next.js 前端
│   ├── app/
│   │   ├── layout.tsx         # 布局、精力环
│   │   ├── page.tsx           # 今日日程
│   │   ├── history/page.tsx   # 历史日历
│   │   └── globals.css
│   ├── components/
│   │   ├── EnergyRing.tsx     # 环形精力条
│   │   ├── TaskForm.tsx       # 添加任务
│   │   ├── TaskList.tsx       # 任务列表、拖拽、编辑
│   │   ├── TimeBar.tsx        # 时间条、午休/晚饭
│   │   └── BreakConfig.tsx    # 休息时段设置
│   ├── lib/
│   │   ├── api.ts             # API 封装
│   │   ├── companionMessages.ts  # 完成陪伴文案库（30 条）
│   │   └── fatigueMessages.ts    # 疲劳预警 fallback 文案
│   └── package.json
│
├── README.md
└── ARCHITECTURE.md
```

---

## 四、后端架构

### 4.1 数据模型

| 表 | 说明 |
|----|------|
| **tasks** | 任务：标题、时长、类型（脑力/体力/休息）、精力消耗、actual_energy、actual_end_time、状态、排程时间 |
| **user_stats** | 精力状态：当前精力 0–100、模式 |
| **day_config** | 日程配置：工作时间、午休、晚饭起止与时长 |
| **companion_logs** | AI 陪伴文案调用记录：task_name、prompt_tokens、completion_tokens、total_tokens |

### 4.2 API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks?date= | 按日期获取任务 |
| POST | /api/tasks | 创建任务 |
| PATCH | /api/tasks/{id} | 更新任务 |
| DELETE | /api/tasks/{id} | 删除任务 |
| POST | /api/tasks/reorder | 拖拽重排 |
| POST | /api/scheduler/schedule | 一键排程 |
| GET | /api/stats | 获取精力 |
| PATCH | /api/stats | 更新精力 |
| GET | /api/config | 获取配置 |
| PATCH | /api/config | 更新配置 |
| POST | /api/daily/sync | 每日同步（结转、精力重置） |
| POST | /api/companion/message | 任务完成陪伴文案（DeepSeek） |
| POST | /api/companion/fatigue-message | 疲劳预警文案（DeepSeek） |

### 4.3 核心逻辑

- **排程**：按脑力/体力/休息交替、精力<40% 时优先排休息与体力；自动跳过午休、晚饭
- **精力**：脑力消耗（正值），休息/体力恢复（负值）；休息 80%、体力 40%
- **配置**：工作时间、午休、晚饭起止与时长统一管理，默认值在 `utils.py` 中集中定义

---

## 五、前端架构

### 5.1 页面

| 路由 | 组件 | 说明 |
|------|------|------|
| / | page.tsx | 今日日程、任务表单、列表、时间条 |
| /history | history/page.tsx | 日历视图、历史任务 |

### 5.2 组件

| 组件 | 职责 |
|------|------|
| EnergyRing | 环形精力条、手动设置精力 |
| TaskForm | 添加任务（标题、时长、类型） |
| TaskList | 任务列表、勾选完成、拖拽排序、编辑时间/时长/类型、完成确认弹窗（预计/实际精力、AI 陪伴文案）、疲劳预警卡片 |
| TimeBar | 8:00–22:00 时间条、午休/晚饭色块可拖动、当前时间线 |
| BreakConfig | 工作时间、午休、晚饭配置 |

### 5.3 数据流

- 通过 `lib/api.ts` 调用后端 API
- 环境变量 `NEXT_PUBLIC_API_URL` 默认 `http://127.0.0.1:8000`
- 完成勾选后通过 `energy-updated` 事件刷新精力环
- 陪伴文案、疲劳预警：后端代理 DeepSeek API，需配置 `DEEPSEEK_API_KEY`
- 疲劳预警冷却：`localStorage` 记录上次触发时间，30 分钟内不重复

---

## 六、部署与运行

- **后端**：`uvicorn app.main:app --reload`，默认 8000 端口
- **前端**：`npm run dev`，默认 3000 端口
- **数据库**：SQLite 文件 `backend/vibe_energy.db`，首次运行自动创建
- **环境变量**：项目根目录 `.env` 配置 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL_CHAT`（AI 文案功能）
