"use client";

import { useState } from "react";
import { api, type TaskCreate } from "@/lib/api";
const ACTIVITY_TYPES = [
  { value: "mental", label: "脑力" },
  { value: "physical", label: "体力" },
  { value: "rest", label: "休息" },
] as const;

interface TaskFormProps {
  date: string;
  onCreated: () => void;
}

export default function TaskForm({ date, onCreated }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [activityType, setActivityType] = useState<"mental" | "physical" | "rest">("mental");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await api.createTask({
        title: title.trim(),
        duration,
        activity_type: activityType,
        scheduled_date: date,
      });
      setTitle("");
      setDuration(30);
      onCreated();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-lg bg-gray-800 border border-gray-700">
      <h2 className="text-lg font-medium">添加任务</h2>
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="任务名"
          className="flex-1 min-w-[120px] px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value) || 30)}
          min={5}
          max={480}
          step={5}
          className="w-20 px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <span className="self-center text-gray-400">分钟</span>
        <select
          value={activityType}
          onChange={(e) => setActivityType(e.target.value as "mental" | "physical" | "rest")}
          className="px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {ACTIVITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50"
        >
          {loading ? "添加中..." : "添加"}
        </button>
      </div>
    </form>
  );
}
