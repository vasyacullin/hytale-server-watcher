import type { FullState, BackupEntry, LogEntry } from "./types";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { copyFile } from "@tauri-apps/plugin-fs";

// Tauri API using invoke
export const api = {
  getFullState: () => invoke<FullState>("get_full_state"),

  getLogs: (limit = 100) => invoke<LogEntry[]>("get_logs", { limit }),

  getBackups: () => invoke<BackupEntry[]>("get_backups"),

  restart: () =>
    invoke<{ success: boolean; message?: string }>("restart_server"),

  stop: () => invoke<{ success: boolean; message?: string }>("stop_server"),

  sendCommand: (command: string) =>
    invoke<{ success: boolean; message?: string }>("send_command", { command }),

  deleteBackup: (filename: string) =>
    invoke<{ success: boolean; message?: string }>("delete_backup_cmd", {
      filename,
    }),

  downloadBackup: async (filename: string) => {
    // Get the source file path from backend
    const sourcePath = await invoke<string>("get_backup_file_path", {
      filename,
    });

    // Open save dialog
    const destPath = await save({
      defaultPath: filename,
      filters: [
        {
          name: "Backup Archive",
          extensions: ["tar.xz"],
        },
      ],
    });

    if (destPath) {
      // Copy the file to the selected destination
      await copyFile(sourcePath, destPath);
    }
  },

  getConfig: () => invoke<any>("get_config"),

  updateConfig: (newConfig: any) =>
    invoke<{ success: boolean; message?: string }>("update_config", {
      newConfig,
    }),
};

// Event types matching the Tauri events
interface StatusEvent {
  status: string;
  pid: number | null;
  uptime_secs: number;
  restart_count: number;
  auto_restart_remaining_secs: number | null;
  next_backup_secs: number | null;
}

interface StatsEvent {
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  network_rx_speed: number;
  network_tx_speed: number;
  disk_read_speed: number;
  disk_write_speed: number;
}

interface LogEvent {
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

// Event listener setup (replaces WebSocket)
export interface EventListeners {
  onStatus?: (data: StatusEvent) => void;
  onStats?: (data: StatsEvent) => void;
  onLog?: (data: LogEvent) => void;
  onError?: (error: Error) => void;
}

export async function setupEventListeners(
  listeners: EventListeners
): Promise<() => void> {
  const unlisteners: UnlistenFn[] = [];

  try {
    if (listeners.onStatus) {
      const unlisten = await listen<StatusEvent>("server-status", (event) => {
        listeners.onStatus!(event.payload);
      });
      unlisteners.push(unlisten);
    }

    if (listeners.onStats) {
      const unlisten = await listen<StatsEvent>("server-stats", (event) => {
        listeners.onStats!(event.payload);
      });
      unlisteners.push(unlisten);
    }

    if (listeners.onLog) {
      const unlisten = await listen<LogEvent>("server-log", (event) => {
        listeners.onLog!(event.payload);
      });
      unlisteners.push(unlisten);
    }
  } catch (error) {
    listeners.onError?.(error as Error);
  }

  // Return cleanup function
  return () => {
    unlisteners.forEach((unlisten) => unlisten());
  };
}

// Legacy WebSocket interface for compatibility (converts to Tauri events)
export function createWebSocket(
  onMessage: (data: any) => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): { close: () => void } {
  let cleanup: (() => void) | null = null;
  let closed = false;

  // Setup event listeners
  setupEventListeners({
    onStatus: (data) => {
      if (!closed) {
        onMessage({ type: "status", data });
      }
    },
    onStats: (data) => {
      if (!closed) {
        onMessage({ type: "stats", data });
      }
    },
    onLog: (data) => {
      if (!closed) {
        onMessage({ type: "log", data });
      }
    },
    onError: (error) => {
      if (!closed) {
        onError?.(new ErrorEvent("error", { error }));
      }
    },
  }).then((cleanupFn) => {
    cleanup = cleanupFn;
  });

  return {
    close: () => {
      closed = true;
      cleanup?.();
      onClose?.();
    },
  };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) {
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  } else if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

export function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  } else if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  return `${seconds}s`;
}
