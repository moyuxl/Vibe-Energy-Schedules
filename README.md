# Vibe-Energy-Schedules

日程时间精力管理系统。基于科学的精力消耗原则，合理规划日程、记录精力变化。

## 版本历史

### V2.0（当前版本）

**完成确认弹窗增强**
- 预计精力随完成时间动态计算（实际时长 = 完成时间 - 开始时间）
- 实际精力只能在预设上下浮动：±5、±10，共 5 个选项
- 完成时间：只能选择任务开始时间 + 30 分钟 ～ 开始时间 + 3 小时

**AI 情绪陪伴文案**
- 任务完成时展示陪伴型文案，语气像朋友
- 优先调用 DeepSeek API 生成个性化文案，失败时使用本地 30 条 fallback
- Skeleton loading + fade in 动画
- 文案样式：霞露臻楷字体、#d03d3f 颜色

**疲劳预警**
- 触发条件（满足任一）：精力 < 35% / 连续 3 个脑力任务 / 连续 2 次实际精力超预计
- 30 分钟冷却，localStorage 记录
- 右下角弹窗，AI 文案 + skeleton loading
- 按钮：「知道了」关闭 / 「去休息」关闭并自动添加 30 分钟休息任务
- 10 秒无操作自动淡出

**其他**
- 任务完成裂纹效果：数量减半、斜向为主
- 后端：陪伴文案 API、疲劳预警 API，Token 消耗记录到 `companion_logs`
- Task 模型：`actual_energy` 字段

**环境变量**（项目根目录 `.env`）：
```
DEEPSEEK_API_KEY=your_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL_CHAT=deepseek-chat
```

---

## 功能概览

- **任务管理**：添加任务（脑力/体力/休息），支持拖拽排序
- **一键排程**：从当前时间开始排程，自动跳过午休/晚饭、已完成时段，时间向上取整到 30 分钟
- **精力系统**：脑力消耗精力，体力恢复 40% 耗时精力，休息恢复 80% 耗时精力
- **完成确认**：勾选完成时弹窗确认实际完成时间、预计/实际精力，展示 AI 陪伴文案
- **疲劳预警**：检测疲劳信号后主动弹出提示卡片
- **已完成置顶**：已完成任务始终显示在上方，时间条色块覆盖刻度

## 启动命令

```bash
# 1. 后端（终端 1）
cd Vibe-Energy-Schedules/backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# 2. 前端（终端 2）
cd Vibe-Energy-Schedules/frontend
npm install
npm run dev
```

访问 `http://localhost:3000`，后端默认 `http://127.0.0.1:8000`。

## 技术栈

前端：Next.js 14、Tailwind、TypeScript | 后端：FastAPI、SQLAlchemy、SQLite
