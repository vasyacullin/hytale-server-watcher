import {
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { api, createWebSocket } from "~/lib/api";
import { useLanguageProvider } from "~/lib/i18n-context";
import { translations } from "~/lib/i18n";
import type {
  FullState,
  WsMessage,
  LogEntry,
  RemoteServer,
} from "~/lib/types";
import { Sidebar } from "~/components/layout/Sidebar";
import { MobileNav } from "~/components/layout/MobileNav";
import { StatusCard } from "~/components/dashboard/StatusCard";
import { ResourcesCard } from "~/components/dashboard/ResourcesCard";
import { LogViewer } from "~/components/dashboard/LogViewer";
import { ActionsCard } from "~/components/dashboard/ActionsCard";
import { BackupsCard } from "~/components/dashboard/BackupsCard";
import { AddServerModal } from "~/components/AddServerModal";

export default component$(() => {
  const language = useLanguageProvider();
  const t = (key: keyof typeof translations.en) =>
    translations[language.value][key] || translations.en[key];

  const state = useStore<FullState>({
    status: {
      status: "stopped",
      pid: null,
      uptime_secs: 0,
      restart_count: 0,
      auto_restart_remaining_secs: null,
      next_backup_secs: null,
    },
    stats: {
      cpu_percent: 0,
      memory_mb: 0,
      memory_percent: 0,
      network_rx_speed: 0,
      network_tx_speed: 0,
      disk_read_speed: 0,
      disk_write_speed: 0,
    },
    logs: [],
    backups: [],
  });

  const remoteServers = useSignal<RemoteServer[]>([]);
  const activeServerId = useSignal<string | null>(null);
  const connected = useSignal(false);
  const error = useSignal<string | null>(null);
  const mobileNavOpen = useSignal(false);
  const addServerModalOpen = useSignal(false);

  const refreshBackups = $(async () => {
    try {
      const backups = await api.getBackups();
      state.backups = backups;
    } catch (e) {
      console.error("Failed to refresh backups:", e);
    }
  });

  const handleAddServer = $((server: RemoteServer) => {
    remoteServers.value = [...remoteServers.value, server];
    addServerModalOpen.value = false;
    // Save to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("remoteServers", JSON.stringify(remoteServers.value));
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    // Load saved remote servers
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("remoteServers");
      if (saved) {
        try {
          remoteServers.value = JSON.parse(saved);
        } catch (e) {
          console.error("Failed to load saved servers:", e);
        }
      }
    }

    // Initial data fetch
    try {
      const fullState = await api.getFullState();
      state.status = fullState.status;
      state.stats = fullState.stats;
      state.logs = fullState.logs;
      state.backups = fullState.backups;
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to connect";
      console.error("Failed to fetch initial state:", e);
    }

    // Tauri event listener (replaces WebSocket)
    const eventListener = createWebSocket(
      (data: WsMessage) => {
        connected.value = true;
        error.value = null;

        switch (data.type) {
          case "status":
            state.status = {
              status: data.data.status,
              pid: data.data.pid,
              uptime_secs: data.data.uptime_secs,
              restart_count: data.data.restart_count,
              auto_restart_remaining_secs: data.data.auto_restart_remaining_secs,
              next_backup_secs: data.data.next_backup_secs,
            };
            break;
          case "stats":
            state.stats = {
              ...state.stats,
              cpu_percent: data.data.cpu_percent,
              memory_mb: data.data.memory_mb,
              memory_percent: data.data.memory_percent,
              network_rx_speed: data.data.network_rx_speed,
              network_tx_speed: data.data.network_tx_speed,
            };
            break;
          case "log":
            state.logs = [...state.logs.slice(-999), data.data as LogEntry];
            break;
        }
      },
      () => {
        connected.value = false;
        error.value = "Event listener error";
      },
      () => {
        connected.value = false;
      }
    );

    // Mark as connected immediately since Tauri events are always available
    connected.value = true;

    return () => {
      eventListener.close();
    };
  });

  return (
    <div class="flex h-screen">
      <Sidebar
        servers={remoteServers.value}
        activeServerId={activeServerId.value}
        onServerSelect$={(id) => {
          activeServerId.value = id;
        }}
        onAddServer$={() => {
          addServerModalOpen.value = true;
        }}
      />

      <MobileNav
        isOpen={mobileNavOpen.value}
        servers={remoteServers.value}
        activeServerId={activeServerId.value}
        onServerSelect$={(id) => {
          activeServerId.value = id;
        }}
        onClose$={() => {
          mobileNavOpen.value = false;
        }}
        onAddServer$={() => {
          addServerModalOpen.value = true;
          mobileNavOpen.value = false;
        }}
      />

      <AddServerModal
        isOpen={addServerModalOpen.value}
        onClose$={() => {
          addServerModalOpen.value = false;
        }}
        onAdd$={handleAddServer}
      />

      <main class="flex-1 overflow-y-auto bg-[var(--color-bg)]">
        {/* Header */}
        <header class="sticky top-0 z-10 bg-[var(--color-bg)]/80 backdrop-blur border-b border-[var(--color-border)] px-4 lg:px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                class="lg:hidden p-2 rounded-lg hover:bg-[var(--color-surface)]"
                onClick$={() => (mobileNavOpen.value = true)}
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h1 class="text-xl lg:text-2xl font-bold">{t("dashboard")}</h1>
                <p class="text-sm text-[var(--color-text-muted)]">
                  {activeServerId.value === null ? t("local") : remoteServers.value.find(s => s.id === activeServerId.value)?.name}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-4">
              {/* Connection status */}
              <div class="flex items-center gap-2">
                <span
                  class={`w-2 h-2 rounded-full ${
                    connected.value ? "bg-green-500" : "bg-red-500"
                  }`}
                ></span>
                <span class="text-sm text-[var(--color-text-muted)] hidden sm:inline">
                  {connected.value ? t("connected") : t("disconnected")}
                </span>
              </div>

              {/* Settings button (mobile) */}
              <a
                href="/settings"
                class="lg:hidden p-2 rounded-lg hover:bg-[var(--color-surface)]"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </a>
            </div>
          </div>
        </header>

        {/* Error banner */}
        {error.value && (
          <div class="mx-4 lg:mx-6 mt-4 px-4 py-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error.value}
          </div>
        )}

        {/* Content */}
        <div class="p-4 lg:p-6 space-y-6">
          {/* Top row */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatusCard
              status={state.status.status}
              pid={state.status.pid}
              uptimeSecs={state.status.uptime_secs}
              restartCount={state.status.restart_count}
              autoRestartRemaining={state.status.auto_restart_remaining_secs}
              nextBackupSecs={state.status.next_backup_secs}
            />
            <ResourcesCard stats={state.stats} />
          </div>

          {/* Actions */}
          <ActionsCard status={state.status.status} />

          {/* Bottom row */}
          <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div class="xl:col-span-2">
              <LogViewer logs={state.logs} />
            </div>
            <BackupsCard backups={state.backups} onRefresh$={refreshBackups} />
          </div>
        </div>
      </main>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Server Watcher",
  meta: [
    {
      name: "description",
      content: "Server monitoring dashboard",
    },
  ],
};
