export interface Router {
  id: number;
  name: string;
  ip_address: string;
  ssh_port: number;
  ssh_user: string;
  location?: string;
  notes?: string;
  tags?: Record<string, string>;
  is_active: boolean;
  last_seen?: string;
  is_online: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScriptExecution {
  id: number;
  router_id: number;
  script_name: string;
  triggered_by: string;
  status: "pending" | "running" | "success" | "error";
  output?: string;
  error?: string;
  duration_ms?: number;
  created_at: string;
  completed_at?: string;
}

export interface Alert {
  id: number;
  router_id: number;
  alert_type: string;
  message: string;
  severity: "info" | "warning" | "critical";
  resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

export interface MetricPoint {
  time: string;
  value: number;
}

export interface SignalMetrics {
  router_id: number;
  range: string;
  rssi: MetricPoint[];
  rsrp: MetricPoint[];
  rsrq: MetricPoint[];
  sinr: MetricPoint[];
}

export interface Script {
  name: string;
  label: string;
  description: string;
  icon: string;
  dangerous?: boolean;
  confirm_message?: string;
}
