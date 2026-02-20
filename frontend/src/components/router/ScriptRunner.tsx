"use client";

import { useState } from "react";
import { Router, Script, ScriptExecution } from "@/lib/types";
import { api } from "@/lib/api";
import {
  Signal,
  Cpu,
  Power,
  Info,
  Network,
  Globe,
  ScrollText,
  Play,
  AlertTriangle,
  CheckCircle,
  Loader,
  XCircle,
} from "lucide-react";
import clsx from "clsx";

const ICON_MAP: Record<string, any> = {
  signal: Signal,
  "sim-card": Cpu,
  power: Power,
  cpu: Info,
  network: Network,
  globe: Globe,
  scroll: ScrollText,
};

interface Props {
  router: Router;
  scripts: Script[];
  onComplete: () => void;
}

export default function ScriptRunner({ router, scripts, onComplete }: Props) {
  const [selected, setSelected] = useState<Script | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScriptExecution | null>(null);
  const [confirmDanger, setConfirmDanger] = useState(false);

  const run = async (script: Script) => {
    if (script.dangerous && !confirmDanger) {
      setConfirmDanger(true);
      return;
    }

    setRunning(true);
    setResult(null);
    setConfirmDanger(false);

    try {
      const execution = await api.post<ScriptExecution>(
        `/routers/${router.id}/execute`,
        {
          router_id: router.id,
          script_name: script.name,
          triggered_by: "ui",
        }
      );

      // Poll for completion
      let attempts = 0;
      const poll = async () => {
        const executions = await api.get<ScriptExecution[]>(
          `/routers/${router.id}/executions?limit=5`
        );
        const latest = executions.find((e) => e.id === execution.id);
        if (latest && (latest.status === "success" || latest.status === "error")) {
          setResult(latest);
          setRunning(false);
          onComplete();
        } else if (attempts < 20) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setRunning(false);
        }
      };
      setTimeout(poll, 2000);
    } catch (e: any) {
      setResult({
        id: 0,
        router_id: router.id,
        script_name: script?.name || "",
        triggered_by: "ui",
        status: "error",
        error: e.message,
        created_at: new Date().toISOString(),
      } as ScriptExecution);
      setRunning(false);
    }
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Script list */}
      <div className="w-72 shrink-0">
        <h3 className="font-mono text-xs text-text-dim uppercase tracking-widest mb-4">
          Available Scripts
        </h3>
        <div className="flex flex-col gap-2">
          {scripts.map((script) => {
            const Icon = ICON_MAP[script.icon] || Play;
            const isSelected = selected?.name === script.name;
            return (
              <button
                key={script.name}
                onClick={() => {
                  setSelected(script);
                  setResult(null);
                  setConfirmDanger(false);
                }}
                disabled={!router.is_online}
                className={clsx(
                  "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                  isSelected
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface hover:border-border hover:bg-surface/80",
                  !router.is_online && "opacity-40 cursor-not-allowed",
                  script.dangerous && "border-danger/30"
                )}
              >
                <Icon
                  size={16}
                  className={clsx(
                    "mt-0.5 shrink-0",
                    isSelected ? "text-accent" : "text-text-dim",
                    script.dangerous && "text-danger"
                  )}
                />
                <div>
                  <p
                    className={clsx(
                      "font-mono text-sm font-bold",
                      isSelected ? "text-accent" : "text-text",
                      script.dangerous && !isSelected && "text-danger"
                    )}
                  >
                    {script.label}
                  </p>
                  <p className="text-text-dim text-xs mt-0.5">
                    {script.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Output panel */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-sm font-bold text-text">
                  {selected.label}
                </h3>
                <p className="text-text-dim text-xs font-mono mt-0.5">
                  Target: {router.name} ({router.ip_address})
                </p>
              </div>

              {/* Run / Confirm button */}
              {confirmDanger ? (
                <div className="flex items-center gap-3">
                  <p className="text-danger text-xs font-mono">
                    {selected.confirm_message}
                  </p>
                  <button
                    onClick={() => run(selected)}
                    className="px-4 py-2 bg-danger text-white font-mono text-sm rounded-lg hover:bg-danger/80 transition-colors"
                  >
                    CONFIRM
                  </button>
                  <button
                    onClick={() => setConfirmDanger(false)}
                    className="px-4 py-2 border border-border text-text-dim font-mono text-sm rounded-lg hover:text-text transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => run(selected)}
                  disabled={running || !router.is_online}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold transition-all",
                    selected.dangerous
                      ? "bg-danger/20 text-danger border border-danger/40 hover:bg-danger/30"
                      : "bg-accent text-background hover:bg-opacity-90",
                    (running || !router.is_online) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {running ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  {running ? "RUNNING..." : "EXECUTE"}
                </button>
              )}
            </div>

            {/* Terminal */}
            <div className="flex-1 relative">
              {running && !result && (
                <div className="terminal h-full flex items-center gap-3">
                  <Loader size={14} className="animate-spin text-accent" />
                  <span className="animate-pulse">
                    Connecting to {router.name}...
                  </span>
                </div>
              )}

              {result && (
                <div className="flex flex-col gap-3 h-full">
                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    {result.status === "success" ? (
                      <CheckCircle size={16} className="text-accent" />
                    ) : (
                      <XCircle size={16} className="text-danger" />
                    )}
                    <span className="font-mono text-xs text-text-dim">
                      {result.status.toUpperCase()} ·{" "}
                      {result.duration_ms
                        ? `${result.duration_ms}ms`
                        : ""}
                    </span>
                  </div>

                  <div className="terminal flex-1 overflow-auto">
                    {result.output || result.error || "No output"}
                  </div>
                </div>
              )}

              {!running && !result && (
                <div className="terminal h-full flex items-center justify-center text-text-dim">
                  Press EXECUTE to run this script
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-dim">
            <div className="text-center">
              <Play size={32} className="mx-auto mb-3 opacity-20" />
              <p className="font-mono text-sm">Select a script to run</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
