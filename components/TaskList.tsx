"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api, type Task } from "@/lib/api";
import { Check, Copy, Trash2, GripVertical } from "lucide-react";
import TimeBar from "./TimeBar";
import { pickRandomCompanionMessage } from "@/lib/companionMessages";
import {
  pickFatigueFallback,
  type FatigueTriggerReason,
} from "@/lib/fatigueMessages";

const FATIGUE_COOLDOWN_KEY = "fatigue_alert_last_trigger";
const FATIGUE_COOLDOWN_MS = 30 * 60 * 1000;

const COMPLETION_EFFECT_DURATION = 800; // 顺时针读条时长
const LONG_PRESS_THRESHOLD = 300; // 超过此毫秒视为长按，开始特效

const DISINTEGRATION_CONFIG = {
  mainCount: { min: 5, max: 8 }, // 减半，降低杂乱感
  highlightColor: "rgba(255, 255, 255, 0.95)",
  refractionColor: "rgba(180, 160, 220, 0.3)",
  jaggedness: { min: 0.3, max: 0.7 },
  segmentDist: { min: 15, max: 40 },
  interconnectionChance: 0.2,
  diagonalBias: 1.2, // 初始角度偏差，越大越斜向（避免竖向/横向）
};

type DisintegrationPath = {
  d: string;
  strokeWidth: number;
  opacity: number;
  id: number;
  isMain: boolean;
};

function generateSurfaceDisintegration(
  boxWidth: number,
  boxHeight: number
): DisintegrationPath[] {
  const paths: DisintegrationPath[] = [];
  const mainCrackCount =
    DISINTEGRATION_CONFIG.mainCount.min +
    Math.floor(
      Math.random() *
        (DISINTEGRATION_CONFIG.mainCount.max - DISINTEGRATION_CONFIG.mainCount.min + 1)
    );
  const collectPoints: [number, number][][] = [];
  const diagonalBias = DISINTEGRATION_CONFIG.diagonalBias;

  for (let i = 0; i < mainCrackCount; i++) {
    const side = Math.floor(Math.random() * 4);
    let startX: number, startY: number, baseAngle: number;
    if (side === 0) {
      startX = Math.random() * boxWidth;
      startY = 0;
      baseAngle = Math.PI / 2;
    } else if (side === 1) {
      startX = boxWidth;
      startY = Math.random() * boxHeight;
      baseAngle = Math.PI;
    } else if (side === 2) {
      startX = Math.random() * boxWidth;
      startY = boxHeight;
      baseAngle = -Math.PI / 2;
    } else {
      startX = 0;
      startY = Math.random() * boxHeight;
      baseAngle = 0;
    }

    const pts: [number, number][] = [[startX, startY]];
    let currentX = startX;
    let currentY = startY;
    // 大幅斜向偏差：避免竖向/横向，使多数裂纹呈对角线走向
    let angle = baseAngle + (Math.random() - 0.5) * diagonalBias;

    while (
      currentX > -100 &&
      currentX < boxWidth + 100 &&
      currentY > -100 &&
      currentY < boxHeight + 100
    ) {
      const dist =
        DISINTEGRATION_CONFIG.segmentDist.min +
        Math.random() *
          (DISINTEGRATION_CONFIG.segmentDist.max - DISINTEGRATION_CONFIG.segmentDist.min);
      const j =
        DISINTEGRATION_CONFIG.jaggedness.min +
        Math.random() *
          (DISINTEGRATION_CONFIG.jaggedness.max - DISINTEGRATION_CONFIG.jaggedness.min);
      angle += (Math.random() - 0.5) * j;
      currentX += Math.cos(angle) * dist;
      currentY += Math.sin(angle) * dist;
      pts.push([currentX, currentY]);
    }
    collectPoints.push(pts);
  }

  collectPoints.forEach((pts, index) => {
    for (let p = 0; p < pts.length - 1; p++) {
      const thickness = Math.max(0.2, 1.2 - p * 0.12);
      const alpha = Math.max(0.1, 1 - p * 0.08);
      paths.push({
        d: `M ${pts[p][0]} ${pts[p][1]} L ${pts[p + 1][0]} ${pts[p + 1][1]}`,
        strokeWidth: thickness,
        opacity: alpha,
        id: index * 100 + p,
        isMain: true,
      });
    }
  });

  return paths;
}

const ACTIVITY_LABELS: Record<string, string> = {
  mental: "脑力",
  physical: "体力",
  rest: "休息",
};

const ACTIVITY_COLORS: Record<string, string> = {
  mental: "bg-indigo-900/60 border-indigo-600",
  physical: "bg-amber-900/60 border-amber-600",
  rest: "bg-emerald-900/60 border-emerald-600",
};

// 与后端一致：休息 80% 恢复，体力 40% 恢复
const ENERGY_COST_MAP: Record<string, number> = {
  mental: 15.0,
  physical: -12.0,
  rest: -24.0,
};
function calcEnergyDelta(duration: number, activityType: string): number {
  const base = ENERGY_COST_MAP[activityType] ?? 0;
  return Math.round(base * (duration / 30) * 10) / 10;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const ACTIVITY_OPTIONS = [
  { value: "mental", label: "脑力" },
  { value: "physical", label: "体力" },
  { value: "rest", label: "休息" },
] as const;

const TIME_OPTIONS: string[] = [];
for (let h = 8; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 22 && m === 30) break;
    TIME_OPTIONS.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
}

/** 完成时间可选范围：任务开始时间 + 30 分钟 ～ 开始时间 + 3 小时 */
function getCompletionTimeOptions(startTime: string): string[] {
  const start = timeToMinutes(startTime || "08:00");
  const min = start + 30;
  const max = start + 180;
  const opts = TIME_OPTIONS.filter((t) => {
    const m = timeToMinutes(t);
    return m >= min && m <= max;
  });
  if (opts.length > 0) return opts;
  return TIME_OPTIONS.filter((t) => timeToMinutes(t) >= min);
}

function clampCompletionTime(timeStr: string, startTime: string): string {
  const opts = getCompletionTimeOptions(startTime);
  if (opts.length === 0) return timeStr;
  const t = timeToMinutes(timeStr);
  const first = timeToMinutes(opts[0]);
  const last = timeToMinutes(opts[opts.length - 1]);
  if (t <= first) return opts[0];
  if (t >= last) return opts[opts.length - 1];
  const found = opts.find((o) => timeToMinutes(o) >= t);
  return found ?? opts[opts.length - 1];
}

function checkFatigueCooldown(): boolean {
  try {
    const last = localStorage.getItem(FATIGUE_COOLDOWN_KEY);
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > FATIGUE_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function setFatigueCooldown(): void {
  try {
    localStorage.setItem(FATIGUE_COOLDOWN_KEY, String(Date.now()));
  } catch {}
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240];

function getDurationOptions(current: number): number[] {
  const set = new Set([...DURATION_OPTIONS, current].sort((a, b) => a - b));
  return Array.from(set);
}

interface TaskListProps {
  date: string;
  tasks: Task[];
  onRefresh: () => void;
  onCopyTask: (task: Task) => void;
}

function TaskItem({
  task,
  index,
  isCurrentTask,
  onToggle,
  onDelete,
  onCopy,
  onReorder,
  onUpdate,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  task: Task;
  index: number;
  isCurrentTask: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onReorder: (fromId: number, toIndex: number) => void;
  onUpdate: (id: number, data: Partial<Task>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const [editingTime, setEditingTime] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [editingType, setEditingType] = useState(false);
  const [effectProgress, setEffectProgress] = useState(0);
  const [effectPhase, setEffectPhase] = useState<"idle" | "active" | "shattered" | "cracked">("idle");
  const [crackPaths, setCrackPaths] = useState<DisintegrationPath[]>([]);
  const progressRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const impactRef = useRef<{ x: number; y: number; boxWidth: number; boxHeight: number } | null>(null);
  const taskCardRef = useRef<HTMLDivElement | null>(null);
  const colorClass = ACTIVITY_COLORS[task.activity_type] ?? "bg-gray-800 border-gray-600";

  useEffect(() => () => {
    if (progressRef.current) cancelAnimationFrame(progressRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  useEffect(() => {
    if (task.status === "pending") {
      setEffectPhase((p) => (p === "cracked" ? "idle" : p));
      setCrackPaths((prev) => (prev.length > 0 ? [] : prev));
    }
  }, [task.status]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("application/json");
    if (draggedId) {
      try {
        const id = parseInt(draggedId, 10);
        if (!isNaN(id) && id !== task.id) onReorder(id, index);
      } catch (_) {}
    }
    onDragEnd();
  };

  const startCompletionEffect = useCallback(() => {
    if (task.status === "completed") return;
    const start = performance.now();
    setEffectPhase("active");
    setEffectProgress(0);

    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(100, (elapsed / COMPLETION_EFFECT_DURATION) * 100);
      setEffectProgress(p);
      if (p >= 100) {
        let boxWidth = 0;
        let boxHeight = 0;
        const impact = impactRef.current;
        if (impact) {
          boxWidth = impact.boxWidth;
          boxHeight = impact.boxHeight;
        } else if (taskCardRef.current) {
          const rect = taskCardRef.current.getBoundingClientRect();
          boxWidth = rect.width;
          boxHeight = rect.height;
        }
        if (boxWidth > 0 && boxHeight > 0) {
          setCrackPaths(generateSurfaceDisintegration(boxWidth, boxHeight));
        }
        impactRef.current = null;
        setEffectPhase("shattered");
        setTimeout(() => {
          setEffectPhase("cracked");
          setEffectProgress(0);
          onToggle();
        }, 500);
      } else {
        progressRef.current = requestAnimationFrame(tick);
      }
    };
    progressRef.current = requestAnimationFrame(tick);
  }, [task.status, onToggle]);

  const cancelCompletionEffect = useCallback(() => {
    if (progressRef.current) {
      cancelAnimationFrame(progressRef.current);
      progressRef.current = null;
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (effectPhase === "active") {
      setEffectPhase("idle");
      setEffectProgress(0);
    }
  }, [effectPhase]);

  const handleCheckboxPointerDown = (e: React.PointerEvent) => {
    if (task.status === "completed") return;
    e.preventDefault();
    const card = (e.target as HTMLElement).closest("[data-task-card]") as HTMLElement | null;
    if (card) {
      const rect = card.getBoundingClientRect();
      impactRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        boxWidth: rect.width,
        boxHeight: rect.height,
      };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      startCompletionEffect();
    }, LONG_PRESS_THRESHOLD);
  };

  const handleCheckboxPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      onToggle();
    } else {
      cancelCompletionEffect();
    }
  };

  const handleCheckboxPointerLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    cancelCompletionEffect();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div
      ref={taskCardRef}
      data-task-card
      draggable
      onDragStart={(e) => {
        onDragStart();
        e.dataTransfer.setData("application/json", String(task.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={`relative flex items-center gap-3 p-3 rounded-lg border transition overflow-hidden ${
        colorClass
      } ${isCurrentTask ? "ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900" : ""} ${
        isDragging ? "opacity-50" : ""
      } ${effectPhase === "active" ? "animate-task-shake" : ""} ${
        effectPhase === "shattered" ? "animate-task-shatter" : ""
      }`}
    >
      {/* 完成后：随机裂纹保留在任务框上 */}
      {((effectPhase === "shattered" || effectPhase === "cracked") && crackPaths.length > 0) && (
        <svg
          width="100%"
          height="100%"
          className="absolute inset-0 pointer-events-none z-30"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        >
          <defs>
            <filter id={`glow-${task.id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" result="blur_refined" />
              <feComposite in="SourceGraphic" in2="blur_refined" operator="over" />
            </filter>
          </defs>
          {crackPaths.map((path) => (
            <path
              key={path.id}
              d={path.d}
              stroke={DISINTEGRATION_CONFIG.highlightColor}
              strokeWidth={path.strokeWidth}
              opacity={path.opacity}
              strokeLinejoin="miter"
              strokeMiterlimit={10}
              fill="none"
              pathLength="100"
              className="crack-grow"
              style={{
                filter: `url(#glow-${task.id})`,
              }}
            />
          ))}
        </svg>
      )}
      <div className="cursor-grab active:cursor-grabbing text-gray-400 flex-shrink-0 relative z-40">
        <GripVertical size={18} />
      </div>
      {/* 勾选框 + 顺时针读条（仅勾选框 2px 边框） */}
      <div className="relative flex-shrink-0 w-6 h-6 z-40">
        {effectPhase === "active" && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none rounded"
            viewBox="0 0 24 24"
          >
            <rect
              x="1"
              y="1"
              width="22"
              height="22"
              rx="4"
              ry="4"
              fill="none"
              stroke="#22c55e"
              strokeWidth="3"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 * (1 - effectProgress / 100)}
              strokeLinecap="round"
            />
          </svg>
        )}
        <button
          onClick={handleCheckboxClick}
          onPointerDown={handleCheckboxPointerDown}
          onPointerUp={handleCheckboxPointerUp}
          onPointerLeave={handleCheckboxPointerLeave}
          onPointerCancel={handleCheckboxPointerUp}
          className={`relative w-full h-full rounded border-2 flex items-center justify-center select-none touch-none ${
            task.status === "completed"
              ? "bg-green-600 border-green-600"
              : "border-gray-500 hover:border-gray-400"
          }`}
        >
          {task.status === "completed" && <Check size={14} className="text-white" />}
        </button>
      </div>
      <div className="flex-1 min-w-0 relative z-40">
        <p className="flex items-baseline gap-2 flex-wrap">
          <span className={task.status === "completed" ? "line-through text-gray-500" : ""}>
            {task.title}
          </span>
          {task.status === "completed" && task.actual_end_time && (
            <span className="text-gray-400 text-sm shrink-0">完成于 {task.actual_end_time}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2 text-sm mt-1">
          {editingTime ? (
            <select
              value={task.start_time || "08:00"}
              onChange={(e) => {
                onUpdate(task.id, { start_time: e.target.value });
                setEditingTime(false);
              }}
              onBlur={() => setEditingTime(false)}
              autoFocus
              className="px-2 py-0.5 rounded bg-gray-700 border border-gray-600 text-gray-200 text-xs"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEditingTime(true)}
              className="text-gray-400 hover:text-gray-200"
            >
              {task.start_time || "—"}
            </button>
          )}
          <span className="text-gray-500">·</span>
          {editingDuration ? (
            <select
              value={task.duration}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v > 0) onUpdate(task.id, { duration: v });
                setEditingDuration(false);
              }}
              onBlur={() => setEditingDuration(false)}
              autoFocus
              className="px-2 py-0.5 rounded bg-gray-700 border border-gray-600 text-gray-200 text-xs"
            >
              {getDurationOptions(task.duration).map((d) => (
                <option key={d} value={d}>{d}分钟</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEditingDuration(true)}
              className="text-gray-400 hover:text-gray-200"
            >
              {task.duration}分钟
            </button>
          )}
          {editingType ? (
            <select
              value={task.activity_type}
              onChange={(e) => {
                onUpdate(task.id, {
                  activity_type: e.target.value as "mental" | "physical" | "rest",
                });
                setEditingType(false);
              }}
              onBlur={() => setEditingType(false)}
              autoFocus
              className="px-2 py-0.5 rounded bg-gray-700 border border-gray-600 text-gray-200 text-xs"
            >
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEditingType(true)}
              className="text-gray-400 hover:text-gray-200"
            >
              {ACTIVITY_LABELS[task.activity_type] ?? task.activity_type}
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0 relative z-40">
        <button
          onClick={onCopy}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
          title="复制"
        >
          <Copy size={16} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-900/50 text-gray-400 hover:text-red-400"
          title="删除"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function TaskList({ date, tasks, onRefresh, onCopyTask }: TaskListProps) {
  const [scheduling, setScheduling] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [completionDialogTask, setCompletionDialogTask] = useState<Task | null>(null);
  const [completionTime, setCompletionTime] = useState("");
  const [completionActualEnergy, setCompletionActualEnergy] = useState<number>(0);
  const [companionMessage, setCompanionMessage] = useState<string>("");
  const [companionLoading, setCompanionLoading] = useState(false);
  const [fatigueCard, setFatigueCard] = useState<{
    triggerReason: FatigueTriggerReason;
    lastTaskName: string;
    currentEnergy: number;
    completedCount: number;
    recentTasksStr: string;
  } | null>(null);
  const [fatigueMessage, setFatigueMessage] = useState<string>("");
  const [fatigueLoading, setFatigueLoading] = useState(false);
  const [fatigueExiting, setFatigueExiting] = useState(false);
  const fatigueAutoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTaskIndex = tasks.findIndex((t) => t.status === "pending");

  const handleToggle = useCallback(
    async (task: Task) => {
      if (task.status === "completed") {
        try {
          await api.updateTask(task.id, {
            status: "pending",
            actual_cost: null,
            actual_end_time: null,
          });
          window.dispatchEvent(new CustomEvent("energy-updated"));
          onRefresh();
        } catch (err) {
          console.error(err);
        }
      } else {
        setCompletionDialogTask(task);
        const now = new Date();
        const total = now.getHours() * 60 + now.getMinutes();
        const snap = Math.round(total / 30) * 30;
        const rawTime = `${Math.floor(snap / 60)
          .toString()
          .padStart(2, "0")}:${(snap % 60).toString().padStart(2, "0")}`;
        const defaultTime = clampCompletionTime(rawTime, task.start_time || "08:00");
        setCompletionTime(defaultTime);
        const start = timeToMinutes(task.start_time || "08:00");
        const end = timeToMinutes(defaultTime);
        const raw = end - start;
        const actualDuration = raw >= 0 ? Math.max(5, Math.min(480, raw)) : task.duration;
        const estimated = calcEnergyDelta(actualDuration, task.activity_type);
        setCompletionActualEnergy(estimated);
      }
    },
    [onRefresh]
  );

  useEffect(() => {
    if (!completionDialogTask) {
      setCompanionMessage("");
      setCompanionLoading(false);
      return;
    }
    const completedCount = tasks.filter((t) => t.status === "completed").length;
    const localMsg = pickRandomCompanionMessage({
      taskName: completionDialogTask.title,
      completedCount,
      energyLeft: undefined,
    });

    setCompanionLoading(true);
    let cancelled = false;
    const done = (msg: string) => {
      if (!cancelled) {
        setCompanionMessage(msg);
        setCompanionLoading(false);
      }
    };

    api
      .getStats()
      .then((stats) => {
        if (cancelled) return;
        const start = timeToMinutes(completionDialogTask.start_time || "08:00");
        const end = timeToMinutes(completionTime);
        const raw = end - start;
        const actualDuration =
          raw >= 0 ? Math.max(5, Math.min(480, raw)) : completionDialogTask.duration;
        const estimated = calcEnergyDelta(actualDuration, completionDialogTask.activity_type);
        return api
          .getCompanionMessage({
            task_name: completionDialogTask.title,
            activity_type: completionDialogTask.activity_type,
            estimated_energy: estimated,
            actual_energy: completionActualEnergy,
            completed_count: completedCount,
            energy_left: stats.current_energy,
          })
          .then((res) => {
            if (cancelled) return;
            if (res.message && res.message.trim().length > 0) {
              done(res.message.trim());
            } else {
              done(localMsg);
            }
          })
          .catch(() => {
            done(localMsg);
          });
      })
      .catch(() => {
        done(localMsg);
      });

    return () => {
      cancelled = true;
    };
    // 仅弹窗打开时请求，不随 completionTime/completionActualEnergy 变化重试
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completionDialogTask]);

  useEffect(() => {
    if (!fatigueCard) return;
    setFatigueLoading(true);
    let cancelled = false;
    const fallback = pickFatigueFallback(fatigueCard.triggerReason, fatigueCard.lastTaskName);

    api
      .getFatigueMessage({
        trigger_reason: fatigueCard.triggerReason,
        current_energy: fatigueCard.currentEnergy,
        completed_count: fatigueCard.completedCount,
        recent_tasks: fatigueCard.recentTasksStr,
      })
      .then((res) => {
        if (cancelled) return;
        setFatigueMessage(res.message?.trim() || fallback);
        setFatigueLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setFatigueMessage(fallback);
          setFatigueLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fatigueCard]);

  useEffect(() => {
    if (!fatigueCard) return;
    fatigueAutoCloseRef.current = setTimeout(() => {
      setFatigueExiting(true);
      setTimeout(() => {
        setFatigueCard(null);
        setFatigueMessage("");
        setFatigueExiting(false);
      }, 250);
    }, 10000);
    return () => {
      if (fatigueAutoCloseRef.current) {
        clearTimeout(fatigueAutoCloseRef.current);
        fatigueAutoCloseRef.current = null;
      }
    };
  }, [fatigueCard]);

  const closeFatigueCard = useCallback(
    (addRest?: boolean) => {
      if (fatigueAutoCloseRef.current) {
        clearTimeout(fatigueAutoCloseRef.current);
        fatigueAutoCloseRef.current = null;
      }
      setFatigueExiting(true);
      setTimeout(() => {
        setFatigueCard(null);
        setFatigueMessage("");
        setFatigueExiting(false);
        if (addRest) {
          const today = new Date().toISOString().slice(0, 10);
          api
            .createTask({
              title: "休息",
              duration: 30,
              activity_type: "rest",
              scheduled_date: today,
            })
            .then(() => api.scheduleTasks(today, true))
            .then(() => {
              onRefresh();
              window.dispatchEvent(new CustomEvent("energy-updated"));
            })
            .catch(console.error);
        }
      }, 250);
    },
    [onRefresh]
  );

  const handleConfirmCompletion = useCallback(
    async () => {
      if (!completionDialogTask) return;
      try {
        await api.updateTask(completionDialogTask.id, {
          status: "completed",
          actual_energy: completionActualEnergy,
          actual_cost: completionActualEnergy,
          actual_end_time: completionTime,
        });
        const stats = await api.getStats();
        const newEnergy = Math.max(0, Math.min(100, stats.current_energy - completionActualEnergy));
        await api.updateStats({ current_energy: newEnergy });
        window.dispatchEvent(new CustomEvent("energy-updated"));
        setCompletionDialogTask(null);
        onRefresh();

        const start = timeToMinutes(completionDialogTask.start_time || "08:00");
        const end = timeToMinutes(completionTime);
        const raw = end - start;
        const actualDuration =
          raw >= 0 ? Math.max(5, Math.min(480, raw)) : completionDialogTask.duration;
        const completionEstimated = calcEnergyDelta(
          actualDuration,
          completionDialogTask.activity_type
        );
        const completedTasks = tasks.filter((t) => t.status === "completed");
        const lastThree = [
          { ...completionDialogTask, activity_type: completionDialogTask.activity_type, actual_energy: completionActualEnergy, energy_cost: completionEstimated },
          ...completedTasks.slice(0, 2),
        ];
        const lastTwo = [
          { actual_energy: completionActualEnergy, energy_cost: completionEstimated },
          completedTasks[0] ? { actual_energy: completedTasks[0].actual_energy ?? 0, energy_cost: completedTasks[0].energy_cost } : null,
        ].filter(Boolean) as { actual_energy: number; energy_cost: number }[];

        let triggerReason: FatigueTriggerReason | null = null;
        if (checkFatigueCooldown()) {
          if (newEnergy < 35) triggerReason = "low_energy";
          else if (
            lastThree.length >= 3 &&
            lastThree.every((t) => t.activity_type === "mental")
          )
            triggerReason = "continuous_mental";
          else if (
            lastTwo.length >= 2 &&
            lastTwo.every((t) => t.actual_energy > t.energy_cost)
          )
            triggerReason = "energy_overrun";
        }

        if (triggerReason) {
          setFatigueCooldown();
          const recentTasks = [
            `${completionDialogTask.title} ${completionActualEnergy}`,
            ...completedTasks.slice(0, 2).map(
              (t) => `${t.title} ${t.actual_energy ?? 0}`
            ),
          ];
          setFatigueCard({
            triggerReason,
            lastTaskName: completionDialogTask.title,
            currentEnergy: newEnergy,
            completedCount: completedTasks.length + 1,
            recentTasksStr: recentTasks.join(", "),
          });
          setFatigueMessage("");
          setFatigueLoading(true);
          setFatigueExiting(false);
        }
      } catch (err) {
        console.error(err);
      }
    },
    [
      completionDialogTask,
      completionTime,
      completionActualEnergy,
      tasks,
      onRefresh,
    ]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await api.deleteTask(id);
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    },
    [onRefresh]
  );

  const handleSchedule = useCallback(async () => {
    setScheduling(true);
    try {
      await api.scheduleTasks(date, true); // 从当前时间开始排程
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setScheduling(false);
    }
  }, [date, onRefresh]);

  const handleReorder = useCallback(
    async (fromId: number, toIndex: number) => {
      const fromIdx = tasks.findIndex((t) => t.id === fromId);
      if (fromIdx < 0) return;
      const newOrder = [...tasks];
      const [removed] = newOrder.splice(fromIdx, 1);
      newOrder.splice(toIndex, 0, removed);
      const taskIds = newOrder.map((t) => t.id);
      try {
        await api.reorderTasks(date, taskIds);
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    },
    [date, tasks, onRefresh]
  );

  const handleUpdate = useCallback(
    async (id: number, data: Partial<Task>) => {
      try {
        await api.updateTask(id, data);
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    },
    [onRefresh]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">今日日程</h2>
        <button
          onClick={handleSchedule}
          disabled={scheduling || tasks.length === 0}
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50"
        >
          {scheduling ? "排程中..." : "一键排程"}
        </button>
      </div>

      <div className="flex gap-0 items-stretch min-h-[800px]">
        <TimeBar completedTasks={tasks.filter((t) => t.status === "completed" && t.start_time)} />
        <div className="flex-1 space-y-2 pl-2 border border-gray-700 rounded-r-lg border-l-0 min-h-[100px]">
        {tasks.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">暂无任务，添加后点击「一键排程」</p>
        ) : (
          tasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              index={index}
              isCurrentTask={index === currentTaskIndex}
              onToggle={() => handleToggle(task)}
              onDelete={() => handleDelete(task.id)}
              onCopy={() => onCopyTask(task)}
              onReorder={handleReorder}
              onUpdate={handleUpdate}
              onDragStart={() => setDraggingId(task.id)}
              onDragEnd={() => setDraggingId(null)}
              isDragging={draggingId === task.id}
            />
          ))
        )}
        </div>
      </div>

      {/* 完成确认弹窗 */}
      {completionDialogTask && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-600 p-4 w-80">
            <h3 className="text-lg font-medium mb-3">确认完成</h3>
            <p className="text-gray-400 text-sm mb-3">{completionDialogTask.title}</p>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400 w-24">完成时间</label>
                <select
                  value={completionTime}
                  onChange={(e) => {
                    const newTime = e.target.value;
                    setCompletionTime(newTime);
                    const start = timeToMinutes(completionDialogTask.start_time || "08:00");
                    const end = timeToMinutes(newTime);
                    const raw = end - start;
                    const actualDuration =
                      raw >= 0 ? Math.max(5, Math.min(480, raw)) : completionDialogTask.duration;
                    const newEstimated = calcEnergyDelta(
                      actualDuration,
                      completionDialogTask.activity_type
                    );
                    setCompletionActualEnergy(newEstimated);
                  }}
                  className="flex-1 px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-200"
                >
                  {getCompletionTimeOptions(completionDialogTask.start_time || "08:00").map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400 w-24">预计精力</label>
                <span className="flex-1 px-3 py-2 rounded bg-gray-700/50 border border-gray-600 text-gray-300 text-sm">
                  {(() => {
                    const start = timeToMinutes(completionDialogTask.start_time || "08:00");
                    const end = timeToMinutes(completionTime);
                    const raw = end - start;
                    const actualDuration =
                      raw >= 0 ? Math.max(5, Math.min(480, raw)) : completionDialogTask.duration;
                    return calcEnergyDelta(actualDuration, completionDialogTask.activity_type);
                  })()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400 w-24">实际精力</label>
                <select
                  value={completionActualEnergy}
                  onChange={(e) => setCompletionActualEnergy(Number(e.target.value))}
                  className="flex-1 px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-200"
                >
                  {(() => {
                    const start = timeToMinutes(completionDialogTask.start_time || "08:00");
                    const end = timeToMinutes(completionTime);
                    const raw = end - start;
                    const actualDuration =
                      raw >= 0 ? Math.max(5, Math.min(480, raw)) : completionDialogTask.duration;
                    const estimated = calcEnergyDelta(
                      actualDuration,
                      completionDialogTask.activity_type
                    );
                    // 实际精力只能在预设上下浮动：±5、±10，共 5 个选项（如预设 30 则 20,25,30,35,40）
                    const offsets = [-10, -5, 0, 5, 10];
                    const options = Array.from(new Set(offsets.map((o) => Math.round((estimated + o) * 10) / 10))).sort(
                      (a, b) => a - b
                    );
                    return options.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>
            <div className="mb-4 min-h-[1.5rem]">
              {companionLoading ? (
                <div
                  className="w-[80%] h-5 rounded bg-slate-600 animate-pulse"
                  aria-label="加载中"
                />
              ) : companionMessage ? (
                <p
                  key={companionMessage}
                  className="text-lg font-bold animate-companion-fade flex items-start gap-1.5"
                  style={{ color: "#d03d3f", fontFamily: '"霞露臻楷", serif' }}
                >
                  <span className="shrink-0" style={{ color: "#d03d3f" }}>✦</span>
                  <span>{companionMessage}</span>
                </p>
              ) : null}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCompletionDialogTask(null)}
                className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
              >
                取消
              </button>
              <button
                onClick={handleConfirmCompletion}
                className="px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white"
              >
                确认完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 疲劳预警卡片 */}
      {fatigueCard && (
        <div
          className={`fixed bottom-16 right-16 z-50 w-96 rounded-lg border border-gray-600 bg-gray-800 p-5 shadow-lg ${
            fatigueExiting ? "animate-fatigue-slide-out" : "animate-fatigue-slide-in"
          }`}
          style={{ fontFamily: '"霞露臻楷", serif' }}
        >
          <h4 className="mb-3 text-base font-medium text-amber-400">
            ⚠ 检测到疲劳信号
          </h4>
          <div className="mb-4 min-h-[1.5rem]">
            {fatigueLoading ? (
              <div
                className="h-5 w-[80%] rounded bg-slate-600 animate-pulse"
                aria-label="加载中"
              />
            ) : fatigueMessage ? (
              <p
                key={fatigueMessage}
                className="animate-companion-fade text-lg"
                style={{ color: "#d03d3f" }}
              >
                {fatigueMessage}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => closeFatigueCard()}
              className="flex-1 rounded bg-gray-700 px-3 py-2 text-gray-300 hover:bg-gray-600"
            >
              知道了
            </button>
            <button
              onClick={() => closeFatigueCard(true)}
              className="flex-1 rounded bg-amber-600 px-3 py-2 text-white hover:bg-amber-500"
            >
              去休息
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
