"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Router, SignalMetrics, ScriptExecution, Script } from "@/lib/types";
import Sidebar from "@/components/ui/Sidebar";
import SignalChart from "@/components/router/SignalChart";
import ScriptRunner from "@/components/router/ScriptRunner";
import ExecutionLog from "@/components/router/ExecutionLog";
import {
  ArrowLeft,
  Signal,
  Clock,
  MapPin,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";

export default function RouterDetailPage() {
  const { id } = useParams();
  const [router, setRouter] = useState<Router | null>(null);
  const [metrics, setMetrics] = useState<SignalMetrics | null>(null);
  const [executions, setExecutions] = useState<ScriptExecution[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [range, setRange] = useState("24h");
  const [tab, setTab] = useState<"charts" | "scripts" | "log">("charts");

  const fetchAll = async () => {
    try {
      const [r, m, e, s] = await Promise.all([
        api.get<Router>(`/routers/${id}`),
        api.get<SignalMetrics>(`/metrics/${id}/signal?range=${range}`),
        api.get<ScriptExecution[]>(`/routers/${id}/executions`),
        api.get<Script[]>(`/routers/scripts/list`),
      ]);
      setRouter(r);
      setMetrics(m);
      setExecutions(e);
      setScripts(s);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [id, range]);

  if (!router) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-accent animate-pulse text-sm">
            Loading router...
          </p>
        </div>
      </div>
    );
  }

  const lastSeen = router.last_seen
    ? formatDistanceToNow(new Date(router.last_seen), { addSuffix: true })
    : "never";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border px-8 py-4 flex items-center gap-6 shrink-0">
          <Link
            href="/"
            className="text-text-dim hover:text-text transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={clsx(
                  "w-3 h-3 rounded-full",
                  router.is_online ? "bg-accent" : "bg-danger"
                )}
              />
              {router.is_online && (
                <div className="absolute inset-0 rounded-full bg-accent animate-ping opacity-30" />
              )}
            </div>
            <div>
              <h1 className="font-display text-lg text-text font-bold">
                {router.name}
              </h1>
              <div className="flex items-center gap-4 mt-0.5">
                <span className="font-mono text-xs text-text-dim">
                  {router.ip_address}
                </span>
                {router.location && (
                  <span className="font-mono text-xs text-text-dim flex items-center gap-1">
                    <MapPin size={10} />
                    {router.location}
                  </span>
                )}
                <span className="font-mono text-xs text-text-dim flex items-center gap-1">
                  <Clock size={10} />
                  {lastSeen}
                </span>
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Range selector */}
            {tab === "charts" && (
              <div className="flex bg-surface border border-border rounded-lg p-1 font-mono text-xs">
                {["1h", "6h", "24h", "7d"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={clsx(
                      "px-3 py-1.5 rounded-md transition-all",
                      range === r
                        ? "bg-accent text-background font-bold"
                        : "text-text-dim hover:text-text"
                    )}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={fetchAll}
              className="p-2 border border-border rounded-lg text-text-dim hover:text-accent hover:border-accent transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="border-b border-border px-8 flex gap-6 shrink-0">
          {[
            { key: "charts", label: "Signal Charts" },
            { key: "scripts", label: "Run Scripts" },
            { key: "log", label: `Execution Log (${executions.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={clsx(
                "py-3 font-mono text-sm border-b-2 transition-colors -mb-px",
                tab === key
                  ? "border-accent text-accent"
                  : "border-transparent text-text-dim hover:text-text"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {tab === "charts" && metrics && (
            <SignalChart metrics={metrics} />
          )}
          {tab === "scripts" && (
            <ScriptRunner
              router={router}
              scripts={scripts}
              onComplete={fetchAll}
            />
          )}
          {tab === "log" && (
            <ExecutionLog executions={executions} />
          )}
        </main>
      </div>
    </div>
  );
}
