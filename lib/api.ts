const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface Task {
  id: number;
  title: string;
  duration: number;
  activity_type: "mental" | "physical" | "rest";
  energy_cost: number;
  actual_cost: number | null;
  actual_energy: number | null;
  actual_end_time: string | null;
  status: string;
  scheduled_date: string | null;
  start_time: string | null;
  sort_order: number;
  created_at?: string;
}

export interface TaskCreate {
  title: string;
  duration: number;
  activity_type: "mental" | "physical" | "rest";
  scheduled_date?: string;
}

export interface UserStats {
  id: number;
  current_energy: number;
  energy_mode: string;
  updated_at?: string;
}

export interface DayConfig {
  id: number;
  work_start: string;
  work_end: string;
  lunch_start: string;
  lunch_duration: number;
  dinner_start: string;
  dinner_duration: number;
}

async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getTasks: (date?: string) =>
    fetchApi<Task[]>(`/api/tasks${date ? `?date=${date}` : ""}`),
  createTask: (task: TaskCreate) =>
    fetchApi<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    }),
  updateTask: (id: number, data: Partial<Task>) =>
    fetchApi<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteTask: (id: number) =>
    fetchApi<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),
  scheduleTasks: (date: string, fromNow = false) =>
    fetchApi<Task[]>("/api/scheduler/schedule", {
      method: "POST",
      body: JSON.stringify({ date, from_now: fromNow }),
    }),
  reorderTasks: (date: string, taskIds: number[]) =>
    fetchApi<Task[]>("/api/tasks/reorder", {
      method: "POST",
      body: JSON.stringify({ date, task_ids: taskIds }),
    }),
  getStats: () => fetchApi<UserStats>("/api/stats"),
  updateStats: (data: { current_energy?: number; energy_mode?: string }) =>
    fetchApi<UserStats>("/api/stats", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  getConfig: () => fetchApi<DayConfig>("/api/config"),
  updateConfig: (data: Partial<DayConfig>) =>
    fetchApi<DayConfig>("/api/config", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  dailySync: () =>
    fetchApi<{ carried_over: number; energy_reset: boolean }>("/api/daily/sync", {
      method: "POST",
    }),
  getCompanionMessage: (data: {
    task_name: string;
    activity_type: string;
    estimated_energy: number;
    actual_energy: number;
    completed_count: number;
    energy_left: number;
  }) =>
    fetchApi<{ message: string | null }>("/api/companion/message", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getFatigueMessage: (data: {
    trigger_reason: string;
    current_energy: number;
    completed_count: number;
    recent_tasks: string;
  }) =>
    fetchApi<{ message: string | null }>("/api/companion/fatigue-message", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
