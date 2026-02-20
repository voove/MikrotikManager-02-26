"use client";

import { Router } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import {
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  MapPin,
  ChevronRight,
  Power,
  Cpu,
  Sim,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useState } from "react";
import clsx from "clsx";

interface Props {
  router: Router;
  onRefresh: () => void;
}

export default function RouterCard({ router, onRefresh }: Props) {
  const [executing, setExecuting] = useState<string | null>(null);

  const quickRun = async (script: string) => {
    if (executing) return;
    setExecuting(script);
    try {
      await api.post(`/routers/${router.id}/execute`, {
        router_id: router.id,
        script_name: script,
        triggered_by: "ui",
      });
    } catch (e) {
      console.error(e);
    } finally {
      setExecuting(null);
    }
  };

  const lastSeen = router.last_seen
    ? formatDistanceToNow(new Date(router.last_seen), { addSuffix: true })
    : "never";

  return (
    <div
      className={clsx(
        "relative bg-surface border rounded-xl overflow-hidden card-hover group",
        router.is_online ? "border-border" : "border-danger/30"
      )}
    >
      {/* Online indicator strip */}
      <div
        className={clsx(
          "absolute top-0 left-0 right-0 h-0.5",
          router.is_online ? "bg-accent" : "bg-danger"
        )}
      />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Status dot */}
            <div className="relative">
              <div
                className={clsx(
                  "w-2.5 h-2.5 rounded-full",
                  router.is_online ? "bg-accent status-online" : "bg-danger"
                )}
              />
              {router.is_online && (
                <div className="absolute inset-0 rounded-full bg-accent animate-ping opacity-30" />
              )}
            </div>

            <div>
              <h3 className="font-display text-sm text-text font-bold tracking-tight leading-none">
                {router.name}
              </h3>
              <p className="text-text-dim font-mono text-xs mt-1">
                {router.ip_address}
              </p>
            </div>
          </div>

          <span
            className={clsx(
              "text-xs font-mono px-2 py-0.5 rounded-full border",
              router.is_online
                ? "text-accent border-accent/30 bg-accent/10"
                : "text-danger border-danger/30 bg-danger/10"
            )}
          >
            {router.is_online ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* Location */}
        {router.location && (
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin size={11} className="text-text-dim" />
            <span className="text-text-dim text-xs font-mono">
              {router.location}
            </span>
          </div>
        )}

        {/* Signal bars visual */}
        <div className="flex items-end gap-1 h-8 mb-4">
          {[1, 2, 3, 4, 5].map((bar) => (
            <div
              key={bar}
              className={clsx(
                "flex-1 rounded-sm transition-all",
                router.is_online
                  ? bar <= 4
                    ? "bg-accent opacity-80"
                    : "bg-border"
                  : "bg-border opacity-40"
              )}
              style={{ height: `${bar * 20}%` }}
            />
          ))}
        </div>

        {/* Last seen */}
        <div className="flex items-center gap-1.5 mb-4">
          <Clock size={11} className="text-text-dim" />
          <span className="text-text-dim text-xs font-mono">
            Last seen {lastSeen}
          </span>
        </div>

        {/* Quick action buttons */}
        <div className="flex gap-2 mt-auto pt-3 border-t border-border">
          <button
            onClick={() => quickRun("signal_strength")}
            disabled={!router.is_online || !!executing}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-mono transition-all",
              router.is_online
                ? "border-border text-text-dim hover:border-accent hover:text-accent"
                : "border-border/30 text-text-dim/30 cursor-not-allowed"
            )}
            title="Check signal strength"
          >
            {executing === "signal_strength" ? (
              <span className="animate-pulse">...</span>
            ) : (
              <>
                <Signal size={12} />
                SIGNAL
              </>
            )}
          </button>

          <button
            onClick={() => quickRun("sim_info")}
            disabled={!router.is_online || !!executing}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-mono transition-all",
              router.is_online
                ? "border-border text-text-dim hover:border-accent hover:text-accent"
                : "border-border/30 text-text-dim/30 cursor-not-allowed"
            )}
            title="SIM card info"
          >
            {executing === "sim_info" ? (
              <span className="animate-pulse">...</span>
            ) : (
              <>
                <Cpu size={12} />
                SIM
              </>
            )}
          </button>

          <Link
            href={`/router/${router.id}`}
            className="flex items-center justify-center w-9 h-9 border border-border rounded-lg text-text-dim hover:text-accent hover:border-accent transition-colors"
          >
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
