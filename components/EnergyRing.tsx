"use client";

import { useEffect, useState } from "react";
import { api, type UserStats } from "@/lib/api";

const RADIUS = 45;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getColor(energy: number): string {
  if (energy >= 60) return "#22c55e";
  if (energy >= 30) return "#eab308";
  return "#ef4444";
}

export default function EnergyRing() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");

  const fetchStats = () => {
    api.getStats().then(setStats).catch(() => setStats(null)).finally(() => setLoading(false));
  };
  useEffect(() => {
    fetchStats();
  }, []);
  useEffect(() => {
    const handler = () => fetchStats();
    window.addEventListener("energy-updated", handler);
    return () => window.removeEventListener("energy-updated", handler);
  }, []);

  const energy = stats?.current_energy ?? 100;
  const dashOffset = CIRCUMFERENCE - (energy / 100) * CIRCUMFERENCE;
  const color = getColor(energy);

  const handleSetEnergy = async () => {
    const v = Math.max(0, Math.min(100, Number(editVal) || 0));
    try {
      await api.updateStats({ current_energy: v });
      setStats((s) => (s ? { ...s, current_energy: v } : null));
      setEditing(false);
    } catch (_) {}
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-pulse h-24 w-24 rounded-full bg-gray-700" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <div className="relative inline-flex items-center justify-center">
        <svg width="120" height="120" className="-rotate-90">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="#374151"
            strokeWidth={STROKE}
          />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className="transition-all duration-500"
          />
        </svg>
        <span className="absolute text-xl font-mono font-bold">
          {Math.round(energy)}%
        </span>
      </div>
      <div className="text-sm text-gray-400">
        <p>精力</p>
        <p className="text-gray-500">{stats?.energy_mode ?? "Gentle"}</p>
        {editing ? (
          <div className="flex gap-1 mt-1">
            <input
              type="number"
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              min={0}
              max={100}
              className="w-14 px-1 py-0.5 rounded bg-gray-700 border border-gray-600 text-gray-100 text-xs"
            />
            <button
              onClick={handleSetEnergy}
              className="px-2 py-0.5 rounded bg-green-600 text-xs text-white"
            >
              确定
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-2 py-0.5 rounded bg-gray-600 text-xs"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditVal(String(Math.round(energy)));
              setEditing(true);
            }}
            className="mt-1 text-xs text-green-500 hover:text-green-400"
          >
            设置精力
          </button>
        )}
      </div>
    </div>
  );
}
