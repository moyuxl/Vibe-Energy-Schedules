"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { api, type Task } from "@/lib/api";
import TaskForm from "@/components/TaskForm";
import TaskList from "@/components/TaskList";
import BreakConfig from "@/components/BreakConfig";

export default function HomePage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(() => {
    api.getTasks(today).then(setTasks).catch(() => setTasks([])).finally(() => setLoading(false));
  }, [today]);

  useEffect(() => {
    api.dailySync().then((r) => {
      if (r.energy_reset) window.dispatchEvent(new CustomEvent("energy-updated"));
    }).catch(() => {}).finally(() => fetchTasks());
  }, [fetchTasks]);

  const handleCopyTask = useCallback(
    async (task: Task) => {
      try {
        await api.createTask({
          title: task.title,
          duration: task.duration,
          activity_type: task.activity_type as "mental" | "physical" | "rest",
          scheduled_date: today,
        });
        fetchTasks();
      } catch (err) {
        console.error(err);
      }
    },
    [today, fetchTasks]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">今日日程</h1>
        <p className="text-gray-500">{format(new Date(), "yyyy年M月d日")}</p>
      </div>

      <TaskForm date={today} onCreated={fetchTasks} />
      <BreakConfig />
      <TaskList
        date={today}
        tasks={tasks}
        onRefresh={fetchTasks}
        onCopyTask={handleCopyTask}
      />

      <div className="pt-4 border-t border-gray-700">
        <Link
          href="/history"
          className="text-green-500 hover:text-green-400 font-medium"
        >
          查看历史 →
        </Link>
      </div>
    </div>
  );
}
