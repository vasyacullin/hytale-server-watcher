import { component$ } from "@builder.io/qwik";
import type { StatsData } from "~/lib/types";
import { formatBytes } from "~/lib/api";

interface ResourcesCardProps {
  stats: StatsData;
}

export const ResourcesCard = component$<ResourcesCardProps>(({ stats }) => {
  const cpuColor =
    stats.cpu_percent > 90
      ? "text-red-500"
      : stats.cpu_percent > 70
        ? "text-yellow-500"
        : "text-green-500";

  const memColor =
    stats.memory_percent > 90
      ? "text-red-500"
      : stats.memory_percent > 70
        ? "text-yellow-500"
        : "text-green-500";

  return (
    <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
      <h2 class="text-lg font-semibold mb-4">Resources</h2>

      <div class="space-y-4">
        {/* CPU */}
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm text-[var(--color-text-muted)]">CPU</span>
            <span class={`font-mono font-medium ${cpuColor}`}>
              {stats.cpu_percent.toFixed(1)}%
            </span>
          </div>
          <div class="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
            <div
              class={`h-full transition-all duration-300 ${
                stats.cpu_percent > 90
                  ? "bg-red-500"
                  : stats.cpu_percent > 70
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${Math.min(stats.cpu_percent, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Memory */}
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm text-[var(--color-text-muted)]">Memory</span>
            <span class={`font-mono font-medium ${memColor}`}>
              {stats.memory_mb} MB ({stats.memory_percent.toFixed(1)}%)
            </span>
          </div>
          <div class="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
            <div
              class={`h-full transition-all duration-300 ${
                stats.memory_percent > 90
                  ? "bg-red-500"
                  : stats.memory_percent > 70
                    ? "bg-yellow-500"
                    : "bg-cyan-500"
              }`}
              style={{ width: `${Math.min(stats.memory_percent, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Network */}
        <div class="grid grid-cols-2 gap-4 pt-2">
          <div class="bg-[var(--color-bg)] rounded-lg p-3">
            <div class="text-xs text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Download
            </div>
            <div class="text-sm font-mono text-cyan-400">
              {formatBytes(stats.network_rx_speed)}/s
            </div>
          </div>

          <div class="bg-[var(--color-bg)] rounded-lg p-3">
            <div class="text-xs text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Upload
            </div>
            <div class="text-sm font-mono text-purple-400">
              {formatBytes(stats.network_tx_speed)}/s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
