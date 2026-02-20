"use client";

import { SignalMetrics } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";

interface Props {
  metrics: SignalMetrics;
}

const SIGNAL_CHARTS = [
  {
    key: "rssi" as const,
    label: "RSSI",
    unit: "dBm",
    color: "#00d4aa",
    good: -70,
    bad: -90,
    description: "Received Signal Strength",
  },
  {
    key: "rsrp" as const,
    label: "RSRP",
    unit: "dBm",
    color: "#60a5fa",
    good: -80,
    bad: -100,
    description: "Reference Signal Received Power",
  },
  {
    key: "rsrq" as const,
    label: "RSRQ",
    unit: "dB",
    color: "#a78bfa",
    good: -10,
    bad: -15,
    description: "Reference Signal Received Quality",
  },
  {
    key: "sinr" as const,
    label: "SINR",
    unit: "dB",
    color: "#f59e0b",
    good: 20,
    bad: 0,
    description: "Signal to Interference + Noise Ratio",
  },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border rounded-lg p-3 font-mono text-xs">
        <p className="text-text-dim mb-1">
          {format(new Date(label), "HH:mm dd MMM")}
        </p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.value?.toFixed(1)} {p.unit}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function SignalChart({ metrics }: Props) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {SIGNAL_CHARTS.map((chart) => {
        const data = metrics[chart.key];
        const latest = data[data.length - 1]?.value;
        const isGood =
          chart.key === "sinr"
            ? latest >= chart.good
            : latest >= chart.good;

        return (
          <div
            key={chart.key}
            className="bg-surface border border-border rounded-xl p-6"
          >
            {/* Chart header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="font-display text-sm font-bold text-text">
                  {chart.label}
                </h3>
                <p className="text-text-dim text-xs font-mono mt-0.5">
                  {chart.description}
                </p>
              </div>
              <div className="text-right">
                <div
                  className="text-2xl font-display font-bold"
                  style={{ color: chart.color }}
                >
                  {latest !== undefined ? latest.toFixed(1) : "—"}
                </div>
                <div className="text-text-dim text-xs font-mono">
                  {chart.unit}
                </div>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-text-dim font-mono text-sm">
                No data in range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={data}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e2830"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(t) => format(new Date(t), "HH:mm")}
                    tick={{ fill: "#4a5568", fontSize: 10, fontFamily: "Fira Code" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#4a5568", fontSize: 10, fontFamily: "Fira Code" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={chart.good}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                  />
                  <ReferenceLine
                    y={chart.bad}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={chart.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: chart.color }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      })}
    </div>
  );
}
