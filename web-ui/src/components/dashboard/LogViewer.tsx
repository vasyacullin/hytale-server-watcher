import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import type { LogEntry, LogLevel } from "~/lib/types";
import { api } from "~/lib/api";

interface LogViewerProps {
  logs: LogEntry[];
}

export const LogViewer = component$<LogViewerProps>(({ logs }) => {
  const containerRef = useSignal<HTMLDivElement>();
  const autoScroll = useSignal(true);
  const commandInput = useSignal("");
  const commandHistory = useSignal<string[]>([]);
  const historyIndex = useSignal(-1);

  // Filters
  const showInfo = useSignal(true);
  const showWarning = useSignal(true);
  const showError = useSignal(true);
  const showCritical = useSignal(true);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => logs.length);

    if (autoScroll.value && containerRef.value) {
      containerRef.value.scrollTop = containerRef.value.scrollHeight;
    }
  });

  const sendCommand = $(async () => {
    const cmd = commandInput.value.trim();
    if (!cmd) return;

    try {
      await api.sendCommand(cmd);
      // Add to history
      commandHistory.value = [...commandHistory.value.slice(-49), cmd];
      historyIndex.value = -1;
      commandInput.value = "";
    } catch (e) {
      console.error("Failed to send command:", e);
    }
  });

  const handleKeyDown = $((e: KeyboardEvent) => {
    if (e.key === "Enter") {
      sendCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.value.length > 0) {
        const newIndex = historyIndex.value < commandHistory.value.length - 1
          ? historyIndex.value + 1
          : historyIndex.value;
        historyIndex.value = newIndex;
        commandInput.value = commandHistory.value[commandHistory.value.length - 1 - newIndex] || "";
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex.value > 0) {
        historyIndex.value = historyIndex.value - 1;
        commandInput.value = commandHistory.value[commandHistory.value.length - 1 - historyIndex.value] || "";
      } else if (historyIndex.value === 0) {
        historyIndex.value = -1;
        commandInput.value = "";
      }
    }
  });

  const levelColors: Record<LogLevel, string> = {
    critical: "text-red-500 font-bold",
    error: "text-red-400",
    warning: "text-yellow-400",
    info: "text-gray-400",
  };

  const levelBadges: Record<LogLevel, string> = {
    critical: "bg-red-500/20 text-red-400",
    error: "bg-red-500/10 text-red-400",
    warning: "bg-yellow-500/10 text-yellow-400",
    info: "bg-gray-500/10 text-gray-400",
  };

  const sourceColors: Record<string, string> = {
    server: "text-cyan-400",
    watcher: "text-purple-400",
    stderr: "text-red-400",
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    switch (log.level) {
      case "info": return showInfo.value;
      case "warning": return showWarning.value;
      case "error": return showError.value;
      case "critical": return showCritical.value;
      default: return true;
    }
  });

  return (
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex flex-col h-[400px]">
      <div class="flex items-center justify-between p-4 border-b border-[var(--color-border)] flex-wrap gap-2">
        <h2 class="text-lg font-semibold">Logs</h2>
        <div class="flex items-center gap-2 flex-wrap">
          {/* Level filters */}
          <div class="flex items-center gap-1">
            <button
              class={`px-2 py-1 rounded text-xs transition-colors ${
                showInfo.value
                  ? "bg-gray-500/20 text-gray-300"
                  : "bg-[var(--color-bg)] text-[var(--color-text-muted)] opacity-50"
              }`}
              onClick$={() => (showInfo.value = !showInfo.value)}
            >
              INFO
            </button>
            <button
              class={`px-2 py-1 rounded text-xs transition-colors ${
                showWarning.value
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-[var(--color-bg)] text-[var(--color-text-muted)] opacity-50"
              }`}
              onClick$={() => (showWarning.value = !showWarning.value)}
            >
              WARN
            </button>
            <button
              class={`px-2 py-1 rounded text-xs transition-colors ${
                showError.value
                  ? "bg-red-500/20 text-red-400"
                  : "bg-[var(--color-bg)] text-[var(--color-text-muted)] opacity-50"
              }`}
              onClick$={() => (showError.value = !showError.value)}
            >
              ERROR
            </button>
            <button
              class={`px-2 py-1 rounded text-xs transition-colors ${
                showCritical.value
                  ? "bg-red-600/30 text-red-300"
                  : "bg-[var(--color-bg)] text-[var(--color-text-muted)] opacity-50"
              }`}
              onClick$={() => (showCritical.value = !showCritical.value)}
            >
              CRIT
            </button>
          </div>
          <div class="w-px h-4 bg-[var(--color-border)]"></div>
          <button
            class={`px-3 py-1 rounded-lg text-sm transition-colors ${
              autoScroll.value
                ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                : "bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            onClick$={() => {
              autoScroll.value = !autoScroll.value;
              if (autoScroll.value && containerRef.value) {
                containerRef.value.scrollTop = containerRef.value.scrollHeight;
              }
            }}
          >
            Auto-scroll {autoScroll.value ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        class="flex-1 overflow-y-auto p-4 font-mono text-sm"
        onScroll$={(e) => {
          const target = e.target as HTMLDivElement;
          const isAtBottom =
            target.scrollHeight - target.scrollTop - target.clientHeight < 50;
          if (!isAtBottom && autoScroll.value) {
            autoScroll.value = false;
          }
        }}
      >
        {filteredLogs.length === 0 ? (
          <div class="text-[var(--color-text-muted)] text-center py-8">
            No logs yet...
          </div>
        ) : (
          <div class="space-y-1">
            {filteredLogs.map((log, index) => (
              <div key={index} class="flex items-start gap-2 py-0.5 hover:bg-[var(--color-bg)]/50 rounded px-2 -mx-2">
                <span class="text-[var(--color-text-muted)] text-xs whitespace-nowrap">
                  {log.timestamp.split(" ")[1]}
                </span>
                <span
                  class={`text-xs px-1.5 py-0.5 rounded ${levelBadges[log.level]} uppercase whitespace-nowrap`}
                >
                  {log.level.slice(0, 4)}
                </span>
                <span class={`text-xs ${sourceColors[log.source]} whitespace-nowrap`}>
                  [{log.source.slice(0, 3).toUpperCase()}]
                </span>
                <span class={`flex-1 ${levelColors[log.level]} break-all`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Command input */}
      <div class="border-t border-[var(--color-border)] p-2">
        <div class="flex items-center gap-2">
          <span class="text-[var(--color-primary)] font-mono">&gt;</span>
          <input
            type="text"
            class="flex-1 bg-transparent border-none outline-none font-mono text-sm placeholder:text-[var(--color-text-muted)]"
            placeholder="Enter command..."
            value={commandInput.value}
            onInput$={(e) => (commandInput.value = (e.target as HTMLInputElement).value)}
            onKeyDown$={handleKeyDown}
          />
          <button
            class="px-3 py-1 rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-sm hover:bg-[var(--color-primary)]/30 transition-colors"
            onClick$={sendCommand}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
});
