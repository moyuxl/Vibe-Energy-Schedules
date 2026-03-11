"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, type Task } from "@/lib/api";

const ACTIVITY_LABELS: Record<string, string> = {
  mental: "脑力",
  physical: "体力",
  rest: "休息",
};

const ACTIVITY_COLORS: Record<string, string> = {
  mental: "border-l-indigo-500",
  physical: "border-l-amber-500",
  rest: "border-l-emerald-500",
};

interface CalendarViewProps {
  onSelectDate: (date: string) => void;
}

export default function CalendarView({ onSelectDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tasksByDate, setTasksByDate] = useState<Record<string, Task[]>>({});

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const handleDateClick = (d: Date) => {
    const dateStr = format(d, "yyyy-MM-dd");
    setSelectedDate(dateStr);
    onSelectDate(dateStr);
    api.getTasks(dateStr).then((tasks) => {
      setTasksByDate((prev) => ({ ...prev, [dateStr]: tasks }));
    });
  };

  const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          {format(currentMonth, "yyyy年M月")}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded hover:bg-gray-700 text-gray-400"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded hover:bg-gray-700 text-gray-400"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-500 mb-2">
        {weekDays.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const isCurrentMonth = isSameMonth(d, currentMonth);
          const isSelected = selectedDate === dateStr;
          const isToday = isSameDay(d, new Date());
          return (
            <button
              key={dateStr}
              onClick={() => handleDateClick(d)}
              className={`aspect-square rounded flex flex-col items-center justify-center text-sm transition ${
                !isCurrentMonth ? "text-gray-600" : "text-gray-200"
              } ${
                isSelected
                  ? "bg-green-600 text-white"
                  : "hover:bg-gray-700"
              } ${isToday ? "ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900" : ""}`}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-6 p-4 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="font-medium mb-3">
            {format(parseISO(selectedDate), "yyyy年M月d日")} 的任务
          </h3>
          {tasksByDate[selectedDate]?.length ? (
            <ul className="space-y-2">
              {tasksByDate[selectedDate].map((t) => (
                <li
                  key={t.id}
                  className={`flex justify-between text-sm pl-3 border-l-4 ${
                    ACTIVITY_COLORS[t.activity_type] ?? "border-l-gray-500"
                  } ${t.status === "completed" ? "text-gray-500 line-through" : ""}`}
                >
                  <span>{t.title}</span>
                  <span className="text-gray-500">
                    {t.start_time && `${t.start_time} · `}
                    {t.duration}分钟 · {ACTIVITY_LABELS[t.activity_type] ?? t.activity_type}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">该日暂无任务</p>
          )}
        </div>
      )}
    </div>
  );
}
