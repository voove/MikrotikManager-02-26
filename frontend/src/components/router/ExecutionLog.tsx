"use client";

import { ScriptExecution } from "@/lib/types";
import { formatDistanceToNow, format } from "date-fns";
import { CheckCircle, XCircle, Clock, Loader, Smartphone, Monitor } from "lucide-react";
import clsx from "clsx";
import { useState } from "react";

interface Props {
  executions: ScriptExecution[];
}

export default function ExecutionLog({ executions }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div>
      <h3 className="font-mono text-xs text-text-dim uppercase tracking-widest mb-4">
        Execution History
      </h3>

      {executions.length === 0 ? (
        <div className="text-center py-16 text-text-dim font-mono text-sm">
          No executions yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {executions.map((exec) => (
            <div
              key={exec.id}
              className="bg-surface border border-border rounded-lg overflow-hidden"
            >
              {/* Row */}
              <button
                onClick={() =>
                  setExpanded(expanded === exec.id ? null : exec.id)
                }
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-border/30 transition-colors"
              >
                {/* Status icon */}
                {exec.status === "success" ? (
                  <CheckCircle size={16} className="text-accent shrink-0" />
                ) : exec.status === "error" ? (
                  <XCircle size={16} className="text-danger shrink-0" />
                ) : exec.status === "running" ? (
                  <Loader size={16} className="text-warning animate-spin shrink-0" />
                ) : (
                  <Clock size={16} className="text-text-dim shrink-0" />
                )}

                {/* Script name */}
                <span className="font-mono text-sm text-text font-bold w-40 shrink-0">
                  {exec.script_name}
                </span>

                {/* Trigger source */}
                <span className="flex items-center gap-1.5 text-text-dim font-mono text-xs w-24 shrink-0">
                  {exec.triggered_by === "sms" ? (
                    <Smartphone size={11} />
                  ) : (
                    <Monitor size={11} />
                  )}
                  {exec.triggered_by.toUpperCase()}
                </span>

                {/* Duration */}
                <span className="font-mono text-xs text-text-dim w-20 shrink-0">
                  {exec.duration_ms ? `${exec.duration_ms}ms` : "—"}
                </span>

                {/* Time */}
                <span className="font-mono text-xs text-text-dim ml-auto">
                  {formatDistanceToNow(new Date(exec.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </button>

              {/* Expanded output */}
              {expanded === exec.id && (exec.output || exec.error) && (
                <div className="border-t border-border p-4">
                  <div className="terminal text-xs max-h-64 overflow-auto">
                    {exec.output || exec.error}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
