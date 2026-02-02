export type ServerStatus =
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "restarting"
  | "error";

export type LogLevel = "critical" | "error" | "warning" | "info";
export type LogSource = "server" | "watcher" | "stderr";

export interface StatusData {
  status: ServerStatus;
  pid: number | null;
  uptime_secs: number;
  restart_count: number;
  auto_restart_remaining_secs: number | null;
  next_backup_secs: number | null;
}

export interface StatsData {
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  network_rx_speed: number;
  network_tx_speed: number;
  disk_read_speed: number;
  disk_write_speed: number;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
}

export interface BackupEntry {
  filename: string;
  size: string;
  size_bytes: number;
  created_at: string;
}

export interface FullState {
  status: StatusData;
  stats: StatsData;
  logs: LogEntry[];
  backups: BackupEntry[];
}

export interface RemoteServer {
  id: string;
  name: string;
  host: string;
  port: number;
  token?: string;
}

export interface WsStatusMessage {
  type: "status";
  data: {
    status: ServerStatus;
    pid: number | null;
    uptime_secs: number;
    restart_count: number;
    auto_restart_remaining_secs: number | null;
    next_backup_secs: number | null;
  };
}

export interface WsStatsMessage {
  type: "stats";
  data: {
    cpu_percent: number;
    memory_mb: number;
    memory_percent: number;
    network_rx_speed: number;
    network_tx_speed: number;
  };
}

export interface WsLogMessage {
  type: "log";
  data: LogEntry;
}

export type WsMessage = WsStatusMessage | WsStatsMessage | WsLogMessage;
