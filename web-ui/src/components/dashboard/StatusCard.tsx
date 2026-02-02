import { component$ } from "@builder.io/qwik";
import type { ServerStatus } from "~/lib/types";
import { formatUptime, formatTimeRemaining } from "~/lib/api";

interface StatusCardProps {
  status: ServerStatus;
  pid: number | null;
  uptimeSecs: number;
  restartCount: number;
  autoRestartRemaining: number | null;
  nextBackupSecs: number | null;
}

export const StatusCard = component$<StatusCardProps>(
  ({ status, pid, uptimeSecs, restartCount, autoRestartRemaining, nextBackupSecs }) => {
    const statusColors: Record<ServerStatus, string> = {
      running: "bg-green-500",
      starting: "bg-yellow-500",
      stopping: "bg-yellow-500",
      stopped: "bg-gray-500",
      restarting: "bg-blue-500",
      error: "bg-red-500",
    };

    const statusLabels: Record<ServerStatus, string> = {
      running: "Running",
      starting: "Starting",
      stopping: "Stopping",
      stopped: "Stopped",
      restarting: "Restarting",
      error: "Error",
    };

    return (
      <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Server Status</h2>
          <div class="flex items-center gap-2">
            <span class={`w-3 h-3 rounded-full ${statusColors[status]} animate-pulse`}></span>
            <span class={`font-medium status-${status}`}>{statusLabels[status]}</span>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-[var(--color-bg)] rounded-lg p-3">
            <div class="text-xs text-[var(--color-text-muted)] mb-1">PID</div>
            <div class="text-lg font-mono">{pid ?? "N/A"}</div>
          </div>

          <div class="bg-[var(--color-bg)] rounded-lg p-3">
            <div class="text-xs text-[var(--color-text-muted)] mb-1">Uptime</div>
            <div class="text-lg font-mono">{formatUptime(uptimeSecs)}</div>
          </div>

          <div class="bg-[var(--color-bg)] rounded-lg p-3">
            <div class="text-xs text-[var(--color-text-muted)] mb-1">Restarts</div>
            <div class="text-lg font-mono text-yellow-400">{restartCount}</div>
          </div>

          <div class="bg-[var(--color-bg)] rounded-lg p-3">
            <div class="text-xs text-[var(--color-text-muted)] mb-1">Auto-Restart</div>
            <div class="text-lg font-mono">
              {autoRestartRemaining !== null
                ? formatTimeRemaining(autoRestartRemaining)
                : "OFF"}
            </div>
          </div>
        </div>

        {nextBackupSecs !== null && (
          <div class="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Next backup in {formatTimeRemaining(nextBackupSecs)}
          </div>
        )}
      </div>
    );
  }
);
