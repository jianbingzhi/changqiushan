"use client";

import { useEffect, useRef, useState } from "react";

type SlotEvent = {
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  capacity: number;
  booked_count: number;
  date: string;
  at: string;
};

export default function DashboardRealtime() {
  const [events, setEvents] = useState<SlotEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/sse/slot_changed");
    sourceRef.current = es;

    es.addEventListener("hello", () => setConnected(true));
    es.addEventListener("slot_changed", (e) => {
      try {
        const data: SlotEvent = JSON.parse((e as MessageEvent).data);
        setEvents((prev) => [data, ...prev].slice(0, 20));
      } catch {
        // ignore
      }
    });
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 p-10">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold">分时配额 · 实时态势</h1>
        <span className={`text-sm px-3 py-1 rounded ${connected ? "bg-green-700" : "bg-red-700"}`}>
          {connected ? "● 已连接" : "○ 未连接"}
        </span>
      </header>

      <p className="text-gray-400 mb-4">
        实时订阅 Postgres NOTIFY <code className="text-cyan-400">slot_changed</code>。
        在数据库手动 UPDATE 任意 booking_slot 行,本页应秒级出现事件。
      </p>

      <ul className="space-y-2">
        {events.length === 0 && <li className="text-gray-500">等待事件…</li>}
        {events.map((e, i) => (
          <li key={`${e.id}-${e.at}-${i}`} className="border border-gray-700 rounded px-4 py-2">
            <span className="text-cyan-400 mr-3">{e.op}</span>
            <span className="font-mono text-sm">{e.id.slice(0, 8)}</span>
            <span className="ml-4">名额 {e.booked_count} / {e.capacity}</span>
            <span className="ml-4 text-gray-500 text-xs">{new Date(e.at).toLocaleTimeString("zh-CN")}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
