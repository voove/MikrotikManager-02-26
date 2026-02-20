"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Router } from "@/lib/types";
import RouterCard from "@/components/dashboard/RouterCard";
import Sidebar from "@/components/ui/Sidebar";
import StatsBar from "@/components/dashboard/StatsBar";
import { RefreshCw, Plus, Wifi, WifiOff } from "lucide-react";

export default function DashboardPage() {
  const [routers, setRouters] = useState<Router[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");

  const fetchRouters = async () => {
    try {
      const data = await api.get<Router[]>("/routers/");
      setRouters(data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRouters();
    const interval = setInterval(fetchRouters, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = routers.filter((r) => {
    if (filter === "online") return r.is_online;
    if (filter === "offline") return !r.is_online;
    return true;
  });

  const onlineCount = routers.filter((r) => r.is_online).length;
  const offlineCount = routers.filter((r) => !r.is_online).length;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-display text-xl text-text tracking-tight">
              Router Fleet
            </h1>
            <p className="text-text-dim text-sm font-mono mt-0.5">
              {routers.length} devices · last sync{" "}
              {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Filter tabs */}
            <div className="flex bg-surface border border-border rounded-lg p-1 font-mono text-sm">
              {[
                { key: "all", label: `ALL ${routers.length}` },
                { key: "online", label: `▲ ${onlineCount}` },
                { key: "offline", label: `▼ ${offlineCount}` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as any)}
                  className={`px-3 py-1.5 rounded-md text-xs transition-all ${
                    filter === key
                      ? "bg-accent text-background font-bold"
                      : "text-text-dim hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={fetchRouters}
              className="p-2 border border-border rounded-lg text-text-dim hover:text-accent hover:border-accent transition-colors"
            >
              <RefreshCw size={16} />
            </button>

            <button className="flex items-center gap-2 px-4 py-2 bg-accent text-background font-display text-sm font-bold rounded-lg hover:bg-opacity-90 transition-all">
              <Plus size={16} />
              Add Router
            </button>
          </div>
        </header>

        {/* Stats bar */}
        <StatsBar routers={routers} />

        {/* Router grid */}
        <main className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="font-mono text-accent text-sm animate-pulse">
                Scanning network...
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-text-dim">
              <WifiOff size={40} className="mb-4 opacity-30" />
              <p className="font-mono text-sm">No routers found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {filtered.map((router) => (
                <RouterCard
                  key={router.id}
                  router={router}
                  onRefresh={fetchRouters}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
