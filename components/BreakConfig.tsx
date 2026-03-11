"use client";

import { useState, useEffect } from "react";
import { api, type DayConfig } from "@/lib/api";
import { Settings2 } from "lucide-react";

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 23; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 23 && m === 30) break;
    TIME_OPTIONS.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
}

const DURATION_OPTIONS = [
  { value: 30, label: "30分钟" },
  { value: 60, label: "1小时" },
  { value: 90, label: "1.5小时" },
  { value: 120, label: "2小时" },
];

export default function BreakConfig() {
  const [config, setConfig] = useState<DayConfig | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  const handleSave = async (updates: Partial<DayConfig>) => {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await api.updateConfig(updates);
      setConfig(updated);
      window.dispatchEvent(new CustomEvent("config-updated"));
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!config) return null;

  return (
    <div className="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-400 hover:text-gray-200"
      >
        <Settings2 size={18} />
        <span className="text-sm">日程设置（工作时间 / 午休 / 晚饭）</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-700 pt-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">工作时间</label>
            <div className="flex gap-2 items-center">
              <select
                value={config.work_start ?? "08:00"}
                onChange={(e) => handleSave({ work_start: e.target.value })}
                className="px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-gray-200 text-sm"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="text-gray-500">至</span>
              <select
                value={config.work_end ?? "22:00"}
                onChange={(e) => handleSave({ work_end: e.target.value })}
                className="px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-gray-200 text-sm"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">午休</label>
              <div className="flex gap-2">
                <select
                  value={config.lunch_start}
                  onChange={(e) => handleSave({ lunch_start: e.target.value })}
                  className="px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-gray-200 text-sm"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={config.lunch_duration}
                  onChange={(e) => handleSave({ lunch_duration: Number(e.target.value) })}
                  className="px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-gray-200 text-sm"
                >
                  {DURATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">晚饭休息</label>
              <div className="flex gap-2">
                <select
                  value={config.dinner_start}
                  onChange={(e) => handleSave({ dinner_start: e.target.value })}
                  className="px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-gray-200 text-sm"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={config.dinner_duration}
                  onChange={(e) => handleSave({ dinner_duration: Number(e.target.value) })}
                  className="px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-gray-200 text-sm"
                >
                  {DURATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {saving && <p className="text-xs text-gray-500">保存中...</p>}
        </div>
      )}
    </div>
  );
}
