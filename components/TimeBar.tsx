"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type DayConfig, type Task } from "@/lib/api";

function parseTime(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// 刻度区域上下留白，避免首尾标签超出容器
const SCALE_TOP_PCT = 6;
const SCALE_BOTTOM_PCT = 94;
const SCALE_RANGE = SCALE_BOTTOM_PCT - SCALE_TOP_PCT;

/** 将时间百分比 (0-100) 映射到刻度区域百分比，留出上下边距 */
function toScalePercent(timePercent: number): number {
  return SCALE_TOP_PCT + (timePercent / 100) * SCALE_RANGE;
}

const ACTIVITY_COLORS: Record<string, string> = {
  mental: "bg-indigo-900/50",
  physical: "bg-amber-900/50",
  rest: "bg-emerald-900/50",
};

interface TimeBarProps {
  completedTasks?: Task[];
}

export default function TimeBar({ completedTasks = [] }: TimeBarProps) {
  const [config, setConfig] = useState<DayConfig | null>(null);
  const [now, setNow] = useState(new Date());

  const workStart = config?.work_start ?? "08:00";
  const workEnd = config?.work_end ?? "22:00";
  const START_MIN = parseTime(workStart);
  const END_MIN = parseTime(workEnd);
  const TOTAL_MIN = END_MIN - START_MIN;

  const timeToPercent = useCallback(
    (timeStr: string) => {
      const min = parseTime(timeStr);
      return ((min - START_MIN) / TOTAL_MIN) * 100;
    },
    [START_MIN, TOTAL_MIN]
  );

  const durationToPercent = useCallback(
    (duration: number) => (duration / TOTAL_MIN) * 100,
    [TOTAL_MIN]
  );

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => setConfig(null));
  }, []);
  useEffect(() => {
    const handler = () => api.getConfig().then(setConfig).catch(() => setConfig(null));
    window.addEventListener("config-updated", handler);
    return () => window.removeEventListener("config-updated", handler);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const currentPercent = (() => {
    const min = now.getHours() * 60 + now.getMinutes();
    if (min < START_MIN) return 0;
    if (min >= END_MIN) return 100;
    return ((min - START_MIN) / TOTAL_MIN) * 100;
  })();

  const lunchTop = config ? timeToPercent(config.lunch_start) : 28.6;
  const lunchHeight = config ? durationToPercent(config.lunch_duration) : 10.7;
  const dinnerTop = config ? timeToPercent(config.dinner_start) : 71.4;
  const dinnerHeight = config ? durationToPercent(config.dinner_duration) : 7.1;

  // 刻度线：每 30 分钟一条，整点加粗
  const tickCount = Math.ceil(TOTAL_MIN / 30);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const min = START_MIN + i * 30;
    const isHour = min % 60 === 0;
    const timePct = (i * 30 / TOTAL_MIN) * 100;
    return { min, isHour, percent: toScalePercent(timePct) };
  });

  // 时间标签：整点，均匀分布在刻度区域内
  const hourCount = Math.floor(TOTAL_MIN / 60) || 1;
  const hourLabels = Array.from({ length: hourCount + 1 }, (_, i) => {
    const min = START_MIN + i * 60;
    const timePct = (i * 60 / TOTAL_MIN) * 100;
    return { min, percent: toScalePercent(timePct) };
  });

  return (
    <div className="flex-shrink-0 w-16 flex flex-col self-stretch min-h-[800px]">
      <div className="relative flex-1 min-h-[800px] bg-gray-800/50 rounded-l-lg border border-r-0 border-gray-700 overflow-hidden">
        {/* 刻度区域：上下留白，避免标签溢出 */}
        <div className="absolute inset-x-0 top-0 bottom-0 pt-5 pb-5">
          {/* 刻度线 */}
          <div className="absolute left-0 top-0 bottom-0 w-8">
            {ticks.map(({ min, isHour, percent }) => (
              <div
                key={min}
                className={`absolute left-0 h-px bg-gray-600 ${isHour ? "w-3 bg-gray-500" : "w-2"}`}
                style={{ top: `${percent}%` }}
              />
            ))}
          </div>
          {/* 时间标签：居中对齐，首尾在留白区内不会溢出 */}
          {hourLabels.map(({ min, percent }) => (
            <div
              key={min}
              className="absolute left-2 right-0 text-xs text-gray-500 pl-1 leading-none"
              style={{
                top: `${percent}%`,
                transform: "translateY(-50%)",
              }}
            >
              {formatTime(min)}
            </div>
          ))}
          {/* 午休时段 - 仅刷色，左侧盖住刻度 */}
          {config && (
            <div
              className="absolute left-0 right-1 bg-amber-900/30 pointer-events-none z-[5]"
              style={{
                top: `${toScalePercent(lunchTop)}%`,
                height: `${(lunchHeight / 100) * SCALE_RANGE}%`,
              }}
            />
          )}
          {/* 晚饭时段 - 仅刷色，左侧盖住刻度 */}
          {config && (
            <div
              className="absolute left-0 right-1 bg-amber-900/30 pointer-events-none z-[6]"
              style={{
                top: `${toScalePercent(dinnerTop)}%`,
                height: `${(dinnerHeight / 100) * SCALE_RANGE}%`,
              }}
            />
          )}
          {/* 已完成任务 - 刷色 */}
          {config &&
            completedTasks.map((task) => {
              if (!task.start_time) return null;
              const startPct = timeToPercent(task.start_time);
              const endTime = task.actual_end_time || (() => {
                const [h, m] = task.start_time!.split(":").map(Number);
                const endMin = h * 60 + m + task.duration;
                const eh = Math.floor(endMin / 60);
                const em = endMin % 60;
                return `${eh.toString().padStart(2, "0")}:${em.toString().padStart(2, "0")}`;
              })();
              const endPct = timeToPercent(endTime);
              const heightPct = Math.max(1, endPct - startPct);
              const colorClass = ACTIVITY_COLORS[task.activity_type] ?? "bg-gray-700/50";
              return (
                <div
                  key={task.id}
                  className={`absolute left-0 right-1 ${colorClass} pointer-events-none z-[7]`}
                  style={{
                    top: `${toScalePercent(startPct)}%`,
                    height: `${(heightPct / 100) * SCALE_RANGE}%`,
                  }}
                />
              );
            })}
          {/* 当前时间线 */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-green-500 z-10 transition-all duration-300 pointer-events-none"
            style={{ top: `${toScalePercent(currentPercent)}%` }}
          >
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
