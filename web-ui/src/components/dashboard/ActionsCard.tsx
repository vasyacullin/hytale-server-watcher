import { component$, useSignal, $ } from "@builder.io/qwik";
import { api } from "~/lib/api";
import type { ServerStatus } from "~/lib/types";

interface ActionsCardProps {
  status: ServerStatus;
}

export const ActionsCard = component$<ActionsCardProps>(({ status }) => {
  const loading = useSignal<string | null>(null);
  const message = useSignal<{ type: "success" | "error"; text: string } | null>(null);

  const handleRestart = $(async () => {
    loading.value = "restart";
    message.value = null;
    try {
      const result = await api.restart();
      message.value = {
        type: "success",
        text: result.message || "Restart command sent",
      };
    } catch (e) {
      message.value = {
        type: "error",
        text: e instanceof Error ? e.message : "Failed to restart",
      };
    } finally {
      loading.value = null;
      setTimeout(() => {
        message.value = null;
      }, 3000);
    }
  });

  const handleStop = $(async () => {
    loading.value = "stop";
    message.value = null;
    try {
      const result = await api.stop();
      message.value = {
        type: "success",
        text: result.message || "Stop command sent",
      };
    } catch (e) {
      message.value = {
        type: "error",
        text: e instanceof Error ? e.message : "Failed to stop",
      };
    } finally {
      loading.value = null;
      setTimeout(() => {
        message.value = null;
      }, 3000);
    }
  });

  const isRunning = status === "running" || status === "starting";

  return (
    <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
      <h2 class="text-lg font-semibold mb-4">Actions</h2>

      <div class="flex flex-wrap gap-3">
        <button
          class="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick$={handleRestart}
          disabled={loading.value !== null}
        >
          {loading.value === "restart" ? (
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              ></path>
            </svg>
          ) : (
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          )}
          Restart
        </button>

        <button
          class="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick$={handleStop}
          disabled={loading.value !== null || !isRunning}
        >
          {loading.value === "stop" ? (
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              ></path>
            </svg>
          ) : (
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
              />
            </svg>
          )}
          Stop
        </button>
      </div>

      {message.value && (
        <div
          class={`mt-4 px-4 py-2 rounded-lg text-sm ${
            message.value.type === "success"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {message.value.text}
        </div>
      )}
    </div>
  );
});
