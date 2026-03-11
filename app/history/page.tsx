"use client";

import Link from "next/link";
import CalendarView from "@/components/CalendarView";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">历史日程</h1>
        <Link
          href="/"
          className="text-green-500 hover:text-green-400 font-medium"
        >
          ← 返回今日
        </Link>
      </div>

      <CalendarView onSelectDate={() => {}} />
    </div>
  );
}
