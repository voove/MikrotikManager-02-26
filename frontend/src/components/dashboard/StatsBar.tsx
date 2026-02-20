"use client";

import { Router } from "@/lib/types";

interface Props {
  routers: Router[];
}

export default function StatsBar({ routers }: Props) {
  const online = routers.filter((r) => r.is_online).length;
  const offline = routers.filter((r) => !r.is_online).length;
  const uptimePct = routers.length > 0 ? Math.round((online / routers.length) * 100) : 0;

  const stats = [
    { label: "TOTAL ROUTERS", value: routers.length, color: "text-text" },
    { label: "ONLINE", value: online, color: "text-accent" },
    { label: "OFFLINE", value: offline, color: "text-danger" },
    { label: "FLEET UPTIME", value: `${uptimePct}%`, color: uptimePct > 90 ? "text-accent" : uptimePct > 70 ? "text-warning" : "text-danger" },
  ];

  return (
    <div className="border-b border-border bg-surface/50 px-8 py-3 flex items-center gap-8 shrink-0">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="font-mono text-xs text-text-dim">{s.label}</span>
          <span className={`font-display text-lg font-bold ${s.color}`}>
            {s.value}
          </span>
        </div>
      ))}

      {/* Uptime bar */}
      <div className="ml-auto flex items-center gap-3">
        <span className="font-mono text-xs text-text-dim">FLEET STATUS</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-4 rounded-sm ${
                i < Math.round((uptimePct / 100) * 20)
                  ? "bg-accent"
                  : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
